import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from 'react'
import { REGION_BY_ID } from '../data/regions'
import { Icon } from '../components/Icon'
import { pickRegion, unionBBox, type MapData, type Rect } from './geo'
import s from './MapView.module.css'

export type RegionState =
  | 'correct'
  | 'wrong'
  | 'target'
  | 'selected'
  | 'captured'
  | 'learning'
  | 'dim'
  | 'found'
  | 'match'

export type MapStyleMode = 'study' | 'board'
export type MapPalette = 'district' | 'neutral'

export interface MapEffect {
  key: string
  id: string
  kind: 'trace' | 'shake' | 'flash' | 'capture'
}

export interface MapCamera {
  flyTo(target: string | string[] | Rect, opts?: { duration?: number; maxZoom?: number; fill?: number }): void
  reset(duration?: number): void
  zoomBy(factor: number): void
  /** Текущий кадр камеры (чтобы вернуться после облёта) */
  getView(): { s: number; tx: number; ty: number }
  setView(v: { s: number; tx: number; ty: number }, duration?: number): void
}

export interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}

interface Props {
  data: MapData
  styleMode: MapStyleMode
  palette?: MapPalette
  states?: Record<string, RegionState | undefined>
  effects?: MapEffect[]
  onRegionClick?: (id: string, info: { proximity: boolean }) => void
  /** Какие регионы можно выбрать (по умолчанию все) */
  selectable?: (id: string) => boolean
  /** Подсвечивать регион под курсором (на ПК) */
  hover?: boolean
  /** Показывать подпись региона при наведении (только в справочнике) */
  hoverLabel?: boolean
  /** Рамки врезок на основной карте */
  insetFrames?: boolean
  /** Медленная «дышащая» анимация (главный экран) */
  ambient?: boolean
  /** Кнопки зума */
  controls?: boolean
  /** Разрешить жесты */
  interactive?: boolean
  /** Отступы под интерфейс поверх карты (в px) */
  padding?: Partial<Padding>
  /** Начальный кадр: регионы, по которым вписать карту */
  initialFocus?: string[]
  cameraRef?: Ref<MapCamera>
  className?: string
  ariaLabel?: string
  extraControls?: React.ReactNode
}

const MIN_ZOOM = 0.85
const MAX_ZOOM = 48
/** Запас отрисовки SVG за краями экрана (доля размера) */
const MARGIN = 0

interface Cam {
  s: number
  tx: number
  ty: number
}

export function MapView(props: Props) {
  const {
    data,
    styleMode,
    palette = 'district',
    states,
    effects,
    onRegionClick,
    selectable,
    hover = true,
    hoverLabel = false,
    insetFrames = false,
    ambient = false,
    controls = true,
    interactive = true,
    padding,
    initialFocus,
    cameraRef,
    className,
    ariaLabel = 'Карта субъектов России',
    extraControls,
  } = props

  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const cam = useRef<Cam>({ s: 0.05, tx: 0, ty: 0 })
  const size = useRef({ w: 0, h: 0 })
  const fitS = useRef(0.05)
  const anim = useRef<number | null>(null)
  const hoverId = useRef<string | null>(null)
  const pending = useRef<(() => void) | null>(null)
  /** Кадр, с которым SVG реально нарисована; во время движения поверх него — CSS-трансформация */
  const committed = useRef<Cam>({ s: 0.05, tx: 0, ty: 0 })
  /** Куда летит камера (чтобы getView во время полёта возвращал цель, а не промежуточный кадр) */
  const animTarget = useRef<Cam | null>(null)
  /** Идёт ли жест / инерция / колесо (тогда не перерисовываем SVG на каждом кадре) */
  const gesture = useRef({ drag: false, inertia: false, wheel: 0 as ReturnType<typeof setTimeout> | 0 })
  const pad = useMemo<Padding>(
    () => ({ top: 0, right: 0, bottom: 0, left: 0, ...padding }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [padding?.top, padding?.right, padding?.bottom, padding?.left],
  )
  const padRef = useRef(pad)
  padRef.current = pad

  // Последние пропсы в ref, чтобы обработчики жестов не пересоздавались
  const live = useRef({ onRegionClick, selectable, hover, hoverLabel, interactive })
  live.current = { onRegionClick, selectable, hover, hoverLabel, interactive }

  // ---------- Камера ----------
  // SVG рисуется с запасом MARGIN с каждой стороны, чтобы при сдвиге «картинкой» не было пустых краёв.
  const margin = () => ({ x: size.current.w * MARGIN, y: size.current.h * MARGIN })

  /** Перерисовать SVG в текущем кадре (дорого: растеризация всей карты). */
  const commit = useCallback(() => {
    const { s: sc, tx, ty } = cam.current
    const m = margin()
    gRef.current?.setAttribute('transform', `translate(${(tx + m.x).toFixed(2)} ${(ty + m.y).toFixed(2)}) scale(${sc.toFixed(6)})`)
    const svg = svgRef.current
    if (svg) {
      svg.style.transform = ''
      svg.style.setProperty('--px', String(1 / sc))
      svg.style.setProperty('--zoom', String(sc / fitS.current))
    }
    committed.current = { ...cam.current }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isMoving = () => anim.current != null || gesture.current.drag || gesture.current.inertia || !!gesture.current.wheel

  /** Показать текущий кадр. Рисуем SVG напрямую: CSS-трансформация «картинки» на больших
   *  экранах давала растянутые и недорисованные кадры. Скорость — за счёт дешёвых слоёв (без масок). */
  const apply = useCallback(() => commit(), [commit])

  /** Движение закончилось — один раз перерисовать начисто. */
  const settle = useCallback(() => {
    if (!isMoving()) commit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit])

  const clamp = useCallback(
    (c: Cam): Cam => {
      const { w, h } = size.current
      const p = padRef.current
      const sc = Math.min(Math.max(c.s, fitS.current * MIN_ZOOM), fitS.current * MAX_ZOOM)
      // центр видимой области должен оставаться над картой
      const vx = p.left + (w - p.left - p.right) / 2
      const vy = p.top + (h - p.top - p.bottom) / 2
      let cx = (vx - c.tx) / sc
      let cy = (vy - c.ty) / sc
      cx = Math.min(Math.max(cx, 0), data.width)
      cy = Math.min(Math.max(cy, 0), data.height)
      return { s: sc, tx: vx - cx * sc, ty: vy - cy * sc }
    },
    [data.width, data.height],
  )

  const frameFor = useCallback(
    (rect: Rect, fill = 0.82, maxZoom = 12): Cam => {
      const { w, h } = size.current
      const p = padRef.current
      const aw = Math.max(40, w - p.left - p.right)
      const ah = Math.max(40, h - p.top - p.bottom)
      const rw = Math.max(rect[2] - rect[0], 1)
      const rh = Math.max(rect[3] - rect[1], 1)
      let sc = Math.min((aw * fill) / rw, (ah * fill) / rh)
      sc = Math.min(sc, fitS.current * maxZoom)
      const cx = (rect[0] + rect[2]) / 2
      const cy = (rect[1] + rect[3]) / 2
      return { s: sc, tx: p.left + aw / 2 - cx * sc, ty: p.top + ah / 2 - cy * sc }
    },
    [],
  )

  const stopAnim = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current)
    anim.current = null
    animTarget.current = null
  }

  const animateTo = useCallback(
    (target: Cam, duration = 650) => {
      stopAnim()
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const from = { ...cam.current }
      const to = clamp(target)
      if (reduce || duration <= 0) {
        cam.current = to
        commit()
        return
      }
      animTarget.current = to
      const { w, h } = size.current
      // Если один кадр «вложен» в другой (приближение к региону, возврат к общему виду),
      // у них есть неподвижная точка P: камера просто масштабируется вокруг неё и не
      // пролетает на большом увеличении над соседними регионами.
      const l0 = Math.log(from.s)
      const l1 = Math.log(to.s)
      const t0 = performance.now()
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
      let frame: (e: number) => Cam
      const ds = from.s - to.s
      const px = Math.abs(ds) > 1e-9 ? (to.tx - from.tx) / ds : NaN
      const py = Math.abs(ds) > 1e-9 ? (to.ty - from.ty) / ds : NaN
      const sx = px * from.s + from.tx
      const sy = py * from.s + from.ty
      const nested = Number.isFinite(sx) && sx >= -0.05 * w && sx <= 1.05 * w && sy >= -0.05 * h && sy <= 1.05 * h
      if (nested) {
        frame = (e) => {
          const sc = Math.exp(l0 + (l1 - l0) * e)
          return { s: sc, tx: sx - px * sc, ty: sy - py * sc }
        }
      } else {
        // кадры не вложены — летим «через» общий план: центр движется в экранных
        // единицах того кадра, который мельче (так пролёт выглядит естественно)
        const c0 = [(w / 2 - from.tx) / from.s, (h / 2 - from.ty) / from.s]
        const c1 = [(w / 2 - to.tx) / to.s, (h / 2 - to.ty) / to.s]
        frame = (e) => {
          const sc = Math.exp(l0 + (l1 - l0) * e)
          const k = from.s > to.s ? 1 - Math.pow(1 - e, 3) : Math.pow(e, 3) // центр — вперёд по пути отдаления
          const cx = c0[0] + (c1[0] - c0[0]) * k
          const cy = c0[1] + (c1[1] - c0[1]) * k
          return { s: sc, tx: w / 2 - cx * sc, ty: h / 2 - cy * sc }
        }
      }
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration)
        cam.current = t < 1 ? frame(ease(t)) : to
        if (t < 1) {
          apply()
          anim.current = requestAnimationFrame(step)
        } else {
          anim.current = null
          animTarget.current = null
          settle()
        }
      }
      anim.current = requestAnimationFrame(step)
    },
    [apply, clamp, commit, settle],
  )

  const fitAll = useCallback(() => frameFor([0, 0, data.width, data.height], 1, 99), [frameFor, data.width, data.height])

  const resolveRect = useCallback(
    (target: string | string[] | Rect): Rect | null => {
      if (typeof target === 'string') return unionBBox(data.regions, [target])
      if (target.length === 4 && typeof target[0] === 'number') return target as Rect
      return unionBBox(data.regions, target as string[])
    },
    [data.regions],
  )

  useImperativeHandle(
    cameraRef,
    () => ({
      flyTo(target, opts = {}) {
        // карта ещё не измерена — выполним после первого измерения
        if (!size.current.w) {
          pending.current = () => this.flyTo(target, opts)
          return
        }
        const rect = resolveRect(target)
        if (!rect) return
        animateTo(frameFor(rect, opts.fill ?? 0.6, opts.maxZoom ?? 14), opts.duration ?? 900)
      },
      reset(duration = 700) {
        animateTo(fitAll(), duration)
      },
      getView() {
        return { ...(animTarget.current ?? cam.current) }
      },
      setView(v, duration = 700) {
        animateTo(v, duration)
      },
      zoomBy(f) {
        const { w, h } = size.current
        const p = padRef.current
        zoomAround(p.left + (w - p.left - p.right) / 2, p.top + (h - p.top - p.bottom) / 2, f, true)
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [animateTo, frameFor, fitAll, resolveRect],
  )

  // Размер контейнера
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let first = true
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      const prev = size.current
      size.current = { w: r.width, h: r.height }
      const svg = svgRef.current
      if (svg) {
        Object.assign(svg.style, {
          left: `${-r.width * MARGIN}px`,
          top: `${-r.height * MARGIN}px`,
          width: `${r.width * (1 + 2 * MARGIN)}px`,
          height: `${r.height * (1 + 2 * MARGIN)}px`,
          transformOrigin: `${r.width * MARGIN}px ${r.height * MARGIN}px`,
        })
      }
      const p = padRef.current
      fitS.current = Math.min((r.width - p.left - p.right) / data.width, (r.height - p.top - p.bottom) / data.height)
      if (first) {
        first = false
        const rect = initialFocus?.length ? resolveRect(initialFocus) : null
        cam.current = clamp(rect ? frameFor(rect, 0.85, 20) : fitAll())
      } else if (prev.w && prev.h) {
        // сохраняем центр при повороте/изменении размера
        const c = cam.current
        const cx = (prev.w / 2 - c.tx) / c.s
        const cy = (prev.h / 2 - c.ty) / c.s
        const ratio = Math.min(r.width / prev.w, r.height / prev.h)
        const sc = c.s * (ratio < 1 ? ratio : 1)
        cam.current = clamp({ s: sc, tx: r.width / 2 - cx * sc, ty: r.height / 2 - cy * sc })
      }
      commit()
      if (pending.current) {
        const fn = pending.current
        pending.current = null
        fn()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // При смене отступов — перевписать
  useEffect(() => {
    const { w, h } = size.current
    if (!w) return
    fitS.current = Math.min((w - pad.left - pad.right) / data.width, (h - pad.top - pad.bottom) / data.height)
    animateTo(cam.current, 0)
  }, [pad, data.width, data.height, animateTo])

  const zoomAround = (sx: number, sy: number, factor: number, animated = false) => {
    const c = cam.current
    const target = Math.min(Math.max(c.s * factor, fitS.current * MIN_ZOOM), fitS.current * MAX_ZOOM)
    const f = target / c.s
    const next = { s: target, tx: sx - (sx - c.tx) * f, ty: sy - (sy - c.ty) * f }
    if (animated) animateTo(next, 320)
    else {
      cam.current = clamp(next)
      apply()
    }
  }

  // ---------- Жесты ----------
  useEffect(() => {
    const svg = wrapRef.current
    if (!svg) return
    const pointers = new Map<number, { x: number; y: number }>()
    let start: { x: number; y: number; t: number; moved: boolean; multi: boolean; type: string } | null = null
    let pinch: { d: number; mx: number; my: number; cam: Cam } | null = null
    let last: { x: number; y: number; t: number } | null = null
    let vel = { x: 0, y: 0 }
    let inertia: number | null = null

    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const r = svg.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const stopInertia = () => {
      if (inertia != null) cancelAnimationFrame(inertia)
      inertia = null
      gesture.current.inertia = false
    }

    const down = (e: PointerEvent) => {
      if (!live.current.interactive) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      stopAnim()
      stopInertia()
      svg.setPointerCapture(e.pointerId)
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 1) {
        start = { ...p, t: performance.now(), moved: false, multi: false, type: e.pointerType }
        last = { ...p, t: performance.now() }
        vel = { x: 0, y: 0 }
      } else if (pointers.size === 2) {
        if (start) start.multi = true
        gesture.current.drag = true
        const [a, b] = [...pointers.values()]
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cam: { ...cam.current } }
      }
    }

    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse' && live.current.hover) hoverAt(e)
        return
      }
      const p = local(e)
      const prev = pointers.get(e.pointerId)!
      pointers.set(e.pointerId, p)
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const c0 = pinch.cam
        const sc = Math.min(Math.max(c0.s * (d / pinch.d), fitS.current * MIN_ZOOM), fitS.current * MAX_ZOOM)
        // точка карты под начальным центром щипка остаётся под пальцами
        const ux = (pinch.mx - c0.tx) / c0.s
        const uy = (pinch.my - c0.ty) / c0.s
        cam.current = clamp({ s: sc, tx: mx - ux * sc, ty: my - uy * sc })
        apply()
        return
      }
      if (!start) return
      const dist = Math.hypot(p.x - start.x, p.y - start.y)
      const threshold = start.type === 'mouse' ? 4 : 9
      if (!start.moved && dist < threshold) return
      if (!start.moved) {
        start.moved = true
        gesture.current.drag = true
        svg.classList.add(s.dragging)
        setHover(null)
      }
      const c = cam.current
      cam.current = clamp({ s: c.s, tx: c.tx + (p.x - prev.x), ty: c.ty + (p.y - prev.y) })
      apply()
      const now = performance.now()
      if (last) {
        const dt = Math.max(1, now - last.t)
        // сглаженная скорость для инерции
        vel = { x: vel.x * 0.6 + ((p.x - last.x) / dt) * 0.4, y: vel.y * 0.6 + ((p.y - last.y) / dt) * 0.4 }
      }
      last = { ...p, t: now }
    }

    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId)
      if (pointers.size === 1 && pinch) {
        // продолжили одним пальцем — без рывка
        pinch = null
        const [only] = [...pointers.values()]
        last = { ...only, t: performance.now() }
        vel = { x: 0, y: 0 }
        return
      }
      if (pointers.size > 0) return
      pinch = null
      svg.classList.remove(s.dragging)
      gesture.current.drag = false
      const st = start
      start = null
      if (!st) return
      const isTap = !st.moved && !st.multi && performance.now() - st.t < 700
      if (isTap && e.type === 'pointerup') {
        settle()
        tapAt(e)
        return
      }
      // инерция
      const idle = last ? performance.now() - last.t : 999
      if (st.moved && !st.multi && idle < 60 && Math.hypot(vel.x, vel.y) > 0.15) {
        let vx = vel.x * 16
        let vy = vel.y * 16
        gesture.current.inertia = true
        const stepI = () => {
          vx *= 0.92
          vy *= 0.92
          const c = cam.current
          cam.current = clamp({ s: c.s, tx: c.tx + vx, ty: c.ty + vy })
          if (Math.hypot(vx, vy) > 0.3) {
            apply()
            inertia = requestAnimationFrame(stepI)
          } else {
            inertia = null
            gesture.current.inertia = false
            settle()
          }
        }
        inertia = requestAnimationFrame(stepI)
      } else settle()
    }

    const wheel = (e: WheelEvent) => {
      if (!live.current.interactive) return
      e.preventDefault()
      stopAnim()
      stopInertia()
      const p = local(e)
      const k = e.ctrlKey ? 0.012 : 0.0022
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      // колесо крутят «пачкой» — перерисовываем начисто, когда пауза 160 мс
      if (gesture.current.wheel) clearTimeout(gesture.current.wheel)
      gesture.current.wheel = setTimeout(() => {
        gesture.current.wheel = 0
        settle()
      }, 160)
      zoomAround(p.x, p.y, Math.exp(-dy * k))
    }

    const dbl = (e: MouseEvent) => {
      if (!live.current.interactive) return
      const p = local(e)
      zoomAround(p.x, p.y, e.shiftKey ? 0.5 : 2, true)
    }

    const leave = () => setHover(null)
    // Гасим эмулированный click после тапа: иначе он может «провалиться»
    // в элемент, который сдвинулся под палец (например, во врезку)
    const touchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
    }
    svg.addEventListener('touchend', touchEnd, { passive: false })

    svg.addEventListener('pointerdown', down)
    svg.addEventListener('pointermove', move)
    svg.addEventListener('pointerup', up)
    svg.addEventListener('pointercancel', up)
    svg.addEventListener('pointerleave', leave)
    svg.addEventListener('wheel', wheel, { passive: false })
    svg.addEventListener('dblclick', dbl)
    return () => {
      stopInertia()
      svg.removeEventListener('pointerdown', down)
      svg.removeEventListener('pointermove', move)
      svg.removeEventListener('pointerup', up)
      svg.removeEventListener('pointercancel', up)
      svg.removeEventListener('pointerleave', leave)
      svg.removeEventListener('wheel', wheel)
      svg.removeEventListener('dblclick', dbl)
      svg.removeEventListener('touchend', touchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const allIds = useMemo(() => Object.keys(data.regions), [data])

  const pickAt = (clientX: number, clientY: number): { id: string | null; proximity: boolean } => {
    const wrap = wrapRef.current
    if (!wrap) return { id: null, proximity: false }
    const r = wrap.getBoundingClientRect()
    const el = document.elementFromPoint(clientX, clientY) as Element | null
    const directRaw = el?.closest?.('[data-id]')?.getAttribute('data-id') ?? null
    const sel = live.current.selectable
    const direct = directRaw && (!sel || sel(directRaw)) ? directRaw : null
    const c = cam.current
    const x = (clientX - r.left - c.tx) / c.s
    const y = (clientY - r.top - c.ty) / c.s
    const ids = sel ? allIds.filter(sel) : allIds
    const coarse = window.matchMedia('(pointer: coarse)').matches
    return pickRegion({ regions: data.regions, ids, x, y, scale: c.s, directId: direct, radiusPx: coarse ? 12 : 8, stealFromDirect: coarse })
  }

  const tapAt = (e: PointerEvent) => {
    const cb = live.current.onRegionClick
    if (!cb) return
    const { id, proximity } = pickAt(e.clientX, e.clientY)
    if (id) cb(id, { proximity })
  }

  const setHover = (id: string | null, e?: PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return
    if (hoverId.current !== id) {
      if (hoverId.current) svg.querySelector(`[data-id="${hoverId.current}"]`)?.classList.remove(s.hovered)
      if (id) svg.querySelector(`[data-id="${id}"]`)?.classList.add(s.hovered)
      hoverId.current = id
      svg.style.cursor = id ? 'pointer' : ''
    }
    const lbl = labelRef.current
    if (lbl) {
      if (id && e && live.current.hoverLabel) {
        const r = wrapRef.current!.getBoundingClientRect()
        lbl.textContent = REGION_BY_ID[id]?.name ?? id
        lbl.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`
        lbl.style.opacity = '1'
      } else lbl.style.opacity = '0'
    }
  }

  let hoverRaf = 0
  const hoverAt = (e: PointerEvent) => {
    if (hoverRaf) return
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0
      const { id } = pickAt(e.clientX, e.clientY)
      setHover(id, e)
    })
  }

  const viewW = data.width
  const viewH = data.height
  const reliefHref = `${import.meta.env.BASE_URL}relief.webp`

  return (
    <div
      ref={wrapRef}
      className={`${s.wrap} ${styleMode === 'board' ? s.board : s.study} ${palette === 'neutral' ? s.neutral : ''} ${ambient ? s.ambient : ''} ${className ?? ''}`}
    >
      <svg ref={svgRef} className={s.svg} role="group" aria-label={ariaLabel}>
        <g ref={gRef}>
          {styleMode === 'board' && <rect className={s.sea} x={-viewW} y={-viewH} width={viewW * 3} height={viewH * 3} />}
          <path className={s.graticule} d={data.graticule} />
          {styleMode === 'board' && (
            <image href={reliefHref} x={0} y={0} width={viewW} height={viewH} preserveAspectRatio="none" className={s.relief} />
          )}
          <path className={s.land} d={data.land} />
          <Regions data={data} states={states} />
          <path className={s.lakes} d={data.lakes} />
          <path className={s.rivers} d={data.rivers} />
          {insetFrames &&
            data.insets.map((ins) => (
              <rect
                key={ins.id}
                className={s.frame}
                x={ins.rect[0]}
                y={ins.rect[1]}
                width={ins.rect[2] - ins.rect[0]}
                height={ins.rect[3] - ins.rect[1]}
              />
            ))}
          <Effects data={data} effects={effects} />
        </g>
      </svg>
      {ambient && <div className={s.sweep} aria-hidden="true" />}
      {hoverLabel && <div ref={labelRef} className={s.hoverLabel} aria-hidden="true" />}
      {controls && (
        <div className={s.controls}>
          {extraControls}
          <button className="icon-btn" aria-label="Приблизить" onClick={() => (cameraRefZoom(cam, 1.6))}>
            <Icon name="plus" size={20} />
          </button>
          <button className="icon-btn" aria-label="Отдалить" onClick={() => cameraRefZoom(cam, 1 / 1.6)}>
            <Icon name="minus" size={20} />
          </button>
          <button className="icon-btn" aria-label="Вся карта" onClick={() => animateTo(fitAll(), 600)}>
            <Icon name="expand" size={19} />
          </button>
        </div>
      )}
    </div>
  )

  function cameraRefZoom(_c: typeof cam, f: number) {
    const { w, h } = size.current
    const p = padRef.current
    zoomAround(p.left + (w - p.left - p.right) / 2, p.top + (h - p.top - p.bottom) / 2, f, true)
  }
}

// ---------- Слои ----------

const Regions = memo(function Regions({
  data,
  states,
}: {
  data: MapData
  states?: Record<string, RegionState | undefined>
}) {
  return (
    <g className={s.regions}>
      {Object.entries(data.regions).map(([id, g]) => {
        const meta = REGION_BY_ID[id]
        const st = states?.[id]
        return (
          <path
            key={id}
            data-id={id}
            data-state={st}
            className={`${s.region} ${s['d_' + meta?.district]}`}
            d={g.d}
            fillRule="evenodd"
            role="img"
            aria-label={meta?.name}
          />
        )
      })}
    </g>
  )
})

/** Заливка при захвате: круг расходится от центра региона, обрезанный по его границе. */
export function CaptureFill({ k, d, c, b }: { k: string; d: string; c: [number, number]; b: [number, number, number, number] }) {
  const r = Math.max(...[b[0], b[2]].flatMap((x) => [b[1], b[3]].map((y) => Math.hypot(x - c[0], y - c[1]))))
  return (
    <g>
      <clipPath id={`cap-${k}`}>
        <path d={d} fillRule="evenodd" />
      </clipPath>
      <g clipPath={`url(#cap-${k})`}>
        <circle className={s.captureFill} cx={c[0]} cy={c[1]} r={r * 1.05} />
        <circle className={s.captureRing} cx={c[0]} cy={c[1]} r={r * 1.05} />
      </g>
    </g>
  )
}

const Effects = memo(function Effects({ data, effects }: { data: MapData; effects?: MapEffect[] }) {
  if (!effects?.length) return null
  return (
    <g className={s.effects} aria-hidden="true">
      {effects.map((ef) => {
        const g = data.regions[ef.id]
        if (!g) return null
        if (ef.kind === 'trace')
          return (
            <g key={ef.key}>
              <path className={s.traceGlow} d={g.d} pathLength={1} />
              <path className={s.trace} d={g.d} pathLength={1} />
            </g>
          )
        if (ef.kind === 'flash') return <path key={ef.key} className={s.flash} d={g.d} fillRule="evenodd" />
        if (ef.kind === 'capture') return <CaptureFill key={ef.key} k={ef.key} d={g.d} c={g.c} b={g.b} />
        return <path key={ef.key} className={s.shake} d={g.d} fillRule="evenodd" />
      })}
    </g>
  )
})
