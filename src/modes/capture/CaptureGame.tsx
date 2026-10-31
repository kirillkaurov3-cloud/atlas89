import { AnimatePresence, m as motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DISTRICT_BY_ID, REGIONS, REGION_BY_ID, type DistrictId } from '../../data/regions'
import { Icon } from '../../components/Icon'
import { MapLayout } from '../../components/MapLayout'
import { toast } from '../../components/Toasts'
import { Insets } from '../../map/Insets'
import { MapView, type MapCamera, type MapEffect, type RegionState } from '../../map/MapView'
import { MapStyleToggle } from '../../map/MapStyleToggle'
import { useMapData } from '../../map/useMapData'
import { preferredCapital } from '../../lib/capitals'
import { emit } from '../../lib/events'
import { applyResult, CAPTURED_LEVEL, pickNext, useCapture } from '../../lib/leitner'
import { useIsPhone } from '../../lib/media'
import { capitalOptions, isCapitalCorrect } from '../../lib/quiz'
import { shuffle } from '../../lib/random'
import { useStore } from '../../lib/store'
import { CapitalTyping, Choices } from '../shared/CapitalAnswer'
import { CountdownRing } from '../shared/CountdownRing'
import q from '../shared/Quiz.module.css'
import c from './Capture.module.css'

type QType = 'find' | 'identify'

type Phase =
  | { k: 'place'; type: QType; startedAt: number; options?: string[] }
  | { k: 'placeFb'; type: QType; ok: boolean; tapped?: string; chosen?: string; options?: string[] }
  | { k: 'capital'; startedAt: number; options: string[] }
  | { k: 'capFb'; ok: boolean; chosen: string | null; options: string[] }

export interface CaptureSummary {
  asked: number
  ok: number
  captured: string[]
  lost: string[]
}

interface Props {
  scope: DistrictId | 'all'
  session: number
  /** Infinity — без конца, пока не выйдешь */
  length: number
  /** Быстрый режим: без ожидания следующей сессии и следующего дня */
  fast: boolean
  onFinish: (s: CaptureSummary) => void
  onExit: () => void
}

/** Варианты для «Что за регион подсвечен?»: соседи (сложнее) + регионы того же округа. */
function identifyOptions(id: string, neighbors: string[]): string[] {
  const r = REGION_BY_ID[id]
  const pool = shuffle(neighbors).concat(shuffle(REGIONS.filter((x) => x.district === r.district).map((x) => x.id)))
  const out: string[] = []
  for (const p of pool) {
    if (p !== id && !out.includes(p)) out.push(p)
    if (out.length === 3) break
  }
  for (const x of shuffle(REGIONS.map((x) => x.id))) {
    if (out.length === 3) break
    if (x !== id && !out.includes(x)) out.push(x)
  }
  return shuffle([id, ...out])
}

export function CaptureGame({ scope, session, length, fast, onFinish, onExit }: Props) {
  const data = useMapData()
  const settings = useStore((s) => s.settings)
  const capture = useCapture()
  const isPhone = useIsPhone()
  const camera = useRef<MapCamera>(null)

  const pool = useMemo(() => (scope === 'all' ? REGIONS : REGIONS.filter((r) => r.district === scope)).map((r) => r.id), [scope])
  const inScope = useMemo(() => new Set(pool), [pool])

  const [qn, setQn] = useState(0)
  const [id, setId] = useState<string | null>(() => pickNext({ pool, session, qn: 0, fast }))
  const [phase, setPhase] = useState<Phase | null>(null)
  const [effects, setEffects] = useState<MapEffect[]>([])
  const [typed, setTyped] = useState<{ ok: boolean; correct: string } | null>(null)
  const summary = useRef<CaptureSummary>({ asked: 0, ok: 0, captured: [], lost: [] })
  const placeOk = useRef(false)
  const effKey = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const region = id ? REGION_BY_ID[id] : null
  const card = id ? capture.cards[id] : undefined
  const correctCapital = region ? preferredCapital(region, settings.capitalPrefs) : null

  const addEffect = (rid: string, kind: MapEffect['kind'], ttl = 1600) => {
    const key = `c${effKey.current++}`
    setEffects((e) => [...e, { key, id: rid, kind }])
    setTimeout(() => setEffects((e) => e.filter((x) => x.key !== key)), ttl)
  }

  // Новый вопрос
  useEffect(() => {
    if (!id || !data) return
    const level = capture.cards[id]?.level ?? 0
    // новые регионы — сначала «узнай» (легче), дальше — «найди» (вспомнить самому)
    const type: QType = level === 0 && !(capture.cards[id]?.wins ?? 0) ? 'identify' : qn % 3 === 2 ? 'identify' : 'find'
    setPhase({
      k: 'place',
      type,
      startedAt: performance.now(),
      options: type === 'identify' ? identifyOptions(id, data.regions[id].n) : undefined,
    })
    placeOk.current = false
    setTyped(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data])

  // «Что за регион подсвечен?» — подлетаем к нему, когда вопрос уже на экране (карта точно существует)
  const placeKey = phase?.k === 'place' && phase.type === 'identify' ? phase.startedAt : 0
  useEffect(() => {
    if (!placeKey || !id) return
    rememberView()
    camera.current?.flyTo(id, { duration: 800, fill: 0.35, maxZoom: scope === 'all' ? 6 : 12 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey])

  /** Базовый вид, куда вернуть камеру после облёта. Запоминаем один раз — не промежуточный кадр полёта. */
  const savedView = useRef<ReturnType<MapCamera['getView']> | null>(null)
  const rememberView = () => {
    if (!savedView.current) savedView.current = camera.current?.getView() ?? null
  }
  const restoreView = () => {
    if (savedView.current) {
      camera.current?.setView(savedView.current, 600)
      savedView.current = null
    }
  }

  const finishCard = (ok: boolean) => {
    if (!id) return
    const res = applyResult(id, ok, session, qn, fast)
    summary.current.asked++
    if (ok) summary.current.ok++
    if (res.justCaptured) {
      summary.current.captured.push(id)
      addEffect(id, 'capture', 2000)
      toast({ title: `Захвачено: ${REGION_BY_ID[id].short}`, text: 'Место и столица — без ошибок на всех уровнях', icon: <Icon name="flag" size={20} />, tone: 'lime' })
    }
    if (res.lost) summary.current.lost.push(id)
  }

  const goNext = () => {
    if (timer.current) clearTimeout(timer.current)
    restoreView()
    const nq = qn + 1
    if (summary.current.asked >= length) return onFinish(summary.current)
    const nextId = pickNext({ pool, session, qn: nq, lastId: id ?? undefined, fast })
    if (!nextId) return onFinish(summary.current)
    setQn(nq)
    if (nextId === id) {
      // тот же регион (редко) — перезапускаем вопрос
      setId(null)
      setTimeout(() => setId(nextId), 0)
    } else setId(nextId)
  }

  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, ms)
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const toCapitalOrFinish = (ok: boolean) => {
    if (!region) return
    if (!ok || !region.capital) {
      finishCard(ok)
      later(goNext, ok ? 900 : 1900)
      return
    }
    later(() => {
      restoreView()
      setPhase({ k: 'capital', startedAt: performance.now(), options: capitalOptions(region, settings.capitalPrefs) })
    }, 800)
  }

  const onRegion = (rid: string) => {
    if (!phase || phase.k !== 'place' || phase.type !== 'find' || !id) return
    const ms = performance.now() - phase.startedAt
    const ok = rid === id
    placeOk.current = ok
    emit('answer', { mode: 'capture', kind: 'find', regionId: id, ok, ms: ok ? ms : undefined, mapStyle: settings.mapStyle })
    setPhase({ k: 'placeFb', type: 'find', ok, tapped: ok ? undefined : rid })
    if (ok) {
      addEffect(id, 'flash', 800)
      addEffect(id, 'trace', 2000)
    } else {
      addEffect(rid, 'shake', 1200)
      rememberView()
      camera.current?.flyTo(id, { duration: 1200, fill: 0.45, maxZoom: 10 })
    }
    toCapitalOrFinish(ok)
  }

  const onIdentify = (rid: string) => {
    if (!phase || phase.k !== 'place' || phase.type !== 'identify' || !id) return
    const ok = rid === id
    placeOk.current = ok
    emit('answer', { mode: 'capture', kind: 'identify', regionId: id, ok, mapStyle: settings.mapStyle })
    setPhase({ k: 'placeFb', type: 'identify', ok, chosen: rid, options: phase.options })
    toCapitalOrFinish(ok)
  }

  const onCapital = (value: string | null) => {
    if (!phase || phase.k !== 'capital' || !region || !id) return
    const ok = value != null && isCapitalCorrect(value, region)
    emit('answer', { mode: 'capture', kind: 'capital', regionId: id, ok, mapStyle: settings.mapStyle })
    setPhase({ k: 'capFb', ok, chosen: value, options: phase.options })
    if (settings.capitalInput === 'typing') setTyped({ ok, correct: correctCapital ?? '' })
    finishCard(ok && placeOk.current)
    later(goNext, ok ? 1000 : 1900)
  }

  // Пробел — дальше
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Escape') onExit()
      if (e.key === ' ' && phase && (phase.k === 'capFb' || (phase.k === 'placeFb' && !phase.ok))) {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------- Состояния карты ----------
  const states = useMemo(() => {
    const st: Record<string, RegionState> = {}
    for (const [rid, cd] of Object.entries(capture.cards)) {
      if (cd.level >= CAPTURED_LEVEL) st[rid] = 'captured'
      else if (cd.level > 0) st[rid] = 'learning'
    }
    if (scope !== 'all') for (const r of REGIONS) if (!inScope.has(r.id)) st[r.id] = 'dim'
    if (id && phase) {
      if (phase.k === 'place' && phase.type === 'identify') st[id] = 'target'
      else if (phase.k === 'placeFb') {
        if (phase.ok) st[id] = 'correct'
        else {
          st[id] = 'target'
          if (phase.tapped) st[phase.tapped] = 'wrong'
        }
      } else if (phase.k === 'capital' || phase.k === 'capFb') st[id] = placeOk.current ? 'correct' : 'target'
    }
    return st
  }, [capture.cards, scope, inScope, id, phase])

  if (!region || !phase) return null

  const kicker =
    phase.k === 'capital' || phase.k === 'capFb'
      ? 'Назови столицу'
      : phase.type === 'identify'
        ? 'Что за регион подсвечен?'
        : 'Найди на карте'
  const showName = !(phase.k === 'place' && phase.type === 'identify')
  const level = card?.level ?? 0

  const question = (
    <div className={`glass ${q.question}`} aria-live="polite">
      <LevelDots level={level} />
      <div className={q.qBody}>
        <div className={q.kicker}>{kicker}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${id}-${showName}`}
            className={`${q.name} ${region.name.length > 28 ? q.nameLong : ''}`}
            data-testid="q-name"
            initial={{ opacity: 0, scale: 1.06, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ transformOrigin: 'left center' }}
          >
            {showName ? region.name : '???'}
          </motion.div>
        </AnimatePresence>
        <FeedbackLine phase={phase} capital={correctCapital} />
      </div>
      <span className={q.counter}>
        {Number.isFinite(length) ? `${Math.min(summary.current.asked + 1, length)}/${length}` : `№ ${summary.current.asked + 1}`}
      </span>
      {Number.isFinite(length) && <span className={q.roundBar} style={{ width: `${(summary.current.asked / length) * 100}%` }} />}
    </div>
  )

  let panel: React.ReactNode
  if (phase.k === 'capital' || phase.k === 'capFb') {
    panel =
      settings.capitalInput === 'typing' ? (
        <CapitalTyping key={`${id}-cap`} onSubmit={onCapital} result={typed} />
      ) : (
        <Choices
          key={`${id}-cap`}
          options={phase.options}
          chosen={phase.k === 'capFb' ? phase.chosen : null}
          correct={phase.k === 'capFb' ? correctCapital : null}
          onPick={onCapital}
        />
      )
  } else if (phase.type === 'identify') {
    const opts = phase.options ?? []
    panel = (
      <Choices
        key={`${id}-id`}
        options={opts.map((o) => REGION_BY_ID[o].name)}
        chosen={phase.k === 'placeFb' && phase.chosen ? REGION_BY_ID[phase.chosen].name : null}
        correct={phase.k === 'placeFb' ? region.name : null}
        onPick={(name) => onIdentify(opts.find((o) => REGION_BY_ID[o].name === name)!)}
      />
    )
  } else {
    panel = (
      <div className={q.actions}>
        <span className={`chip ${c.hintChip}`}>
          <CountdownRing startedAt={phase.k === 'place' ? phase.startedAt : null} duration={0} size={26} stroke={3} />
          Без таймера — учимся
        </span>
        <button className="btn btn-ghost" onClick={() => onRegion('__skip__')} disabled={phase.k !== 'place'}>
          Не знаю
        </button>
      </div>
    )
  }

  const captured = Object.values(capture.cards).filter((x) => x.level >= CAPTURED_LEVEL).length

  return (
    <MapLayout
      title={scope === 'all' ? 'Захват карты' : `Захват: ${DISTRICT_BY_ID[scope].short}`}
      onBack={() => (summary.current.asked ? onFinish(summary.current) : onExit())}
      headerRight={
        <>
          <span className={`chip ${c.capChip}`}>
            <Icon name="flag" size={14} /> {captured}/89
          </span>
          <MapStyleToggle />
        </>
      }
      top={question}
      map={
        data && (
          <MapView
            data={data}
            styleMode={settings.mapStyle}
            palette="neutral"
            states={states}
            effects={effects}
            onRegionClick={onRegion}
            selectable={(rid) => inScope.has(rid)}
            cameraRef={camera}
            initialFocus={scope === 'all' ? undefined : pool}
            insetFrames
          />
        )
      }
      insets={
        data &&
        !(isPhone && (phase.k === 'capital' || phase.k === 'capFb' || phase.type === 'identify')) && (
          <Insets
            data={data}
            styleMode={settings.mapStyle}
            palette="neutral"
            states={states}
            effects={effects}
            onRegionClick={onRegion}
            selectable={(rid) => inScope.has(rid)}
            only={scope === 'all' ? undefined : data.insets.filter((i) => i.ids.some((x) => inScope.has(x))).map((i) => i.id)}
          />
        )
      }
      panel={<div className={q.panel}>{panel}</div>}
    />
  )
}

function LevelDots({ level }: { level: number }) {
  return (
    <div className={c.levels} aria-label={`Уровень ${level} из ${CAPTURED_LEVEL}`} title="Уровень освоения">
      {Array.from({ length: CAPTURED_LEVEL }, (_, i) => (
        <span key={i} className={`${c.dot} ${i < level ? c.dotOn : ''}`} />
      ))}
    </div>
  )
}

function FeedbackLine({ phase, capital }: { phase: Phase; capital: string | null }) {
  let text: string | null = null
  let ok = false
  if (phase.k === 'placeFb') {
    ok = phase.ok
    text = phase.ok ? 'Верно!' : phase.tapped === '__skip__' ? 'Вот где он' : phase.tapped ? `Это ${REGION_BY_ID[phase.tapped]?.name}` : 'Не угадал'
  } else if (phase.k === 'capFb') {
    ok = phase.ok
    text = phase.ok ? `Верно, ${capital}` : `Столица — ${capital}`
  }
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text}
          className={`${q.feedback} ${ok ? q.ok : q.bad}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
