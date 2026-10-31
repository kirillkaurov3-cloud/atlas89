import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { REGION_BY_ID } from '../../data/regions'
import { MapLayout } from '../../components/MapLayout'
import { Modal } from '../../components/Modal'
import { Insets } from '../../map/Insets'
import { MapView, type MapCamera, type MapEffect, type RegionState } from '../../map/MapView'
import { MapStyleToggle } from '../../map/MapStyleToggle'
import { useMapData } from '../../map/useMapData'
import { emit } from '../../lib/events'
import { formatTime } from '../../lib/share'
import { useStore } from '../../lib/store'
import q from '../shared/Quiz.module.css'
import s from './Speedrun.module.css'

export const PENALTY_MS = 5000
export const SKIP_PENALTY_MS = 15000

export interface SpeedrunResult {
  /** итоговое время с штрафами, мс */
  totalMs: number
  /** чистое время, мс */
  rawMs: number
  errors: number
  skips: number
  /** регионы, на которых были ошибки или пропуск */
  missed: string[]
  ids: string[]
}

interface Props {
  ids: string[]
  rival?: { name: string; ms: number }
  onFinish: (r: SpeedrunResult) => void
  onExit: () => void
}

export function SpeedrunGame({ ids, rival, onFinish, onExit }: Props) {
  const data = useMapData()
  const mapStyle = useStore((st) => st.settings.mapStyle)
  const camera = useRef<MapCamera>(null)
  const [index, setIndex] = useState(0)
  const [found, setFound] = useState<string[]>([])
  const [effects, setEffects] = useState<MapEffect[]>([])
  const [penalties, setPenalties] = useState<{ key: number; ms: number }[]>([])
  const [paused, setPaused] = useState(false)
  const [started, setStarted] = useState(false)
  const effKey = useRef(0)
  const clock = useRef<HTMLSpanElement>(null)
  const rivalBar = useRef<HTMLSpanElement>(null)

  // время: старт, накопленные паузы, штрафы
  const t0 = useRef(0)
  const pausedAt = useRef<number | null>(null)
  const penaltyMs = useRef(0)
  const errors = useRef(0)
  const skips = useRef(0)
  const missed = useRef(new Set<string>())
  const lastFoundAt = useRef(0)

  const id = ids[index]
  const region = REGION_BY_ID[id]

  const now = () => performance.now()
  const elapsed = () => (pausedAt.current ?? now()) - t0.current + penaltyMs.current

  // Старт после загрузки карты, обратный отсчёт 3-2-1
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (!data) return
    if (count <= 0) {
      t0.current = now()
      lastFoundAt.current = now()
      setStarted(true)
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [data, count])

  // Секундомер — напрямую в DOM
  useEffect(() => {
    if (!started) return
    let raf = 0
    const tick = () => {
      const ms = elapsed()
      if (clock.current) clock.current.textContent = formatTime(ms)
      if (rival && rivalBar.current) rivalBar.current.style.width = `${Math.min(100, (ms / rival.ms) * 100)}%`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  const addEffect = (rid: string, kind: MapEffect['kind'], ttl = 1000) => {
    const key = `s${effKey.current++}`
    setEffects((e) => [...e, { key, id: rid, kind }])
    setTimeout(() => setEffects((e) => e.filter((x) => x.key !== key)), ttl)
  }

  const penalize = (ms: number) => {
    penaltyMs.current += ms
    const key = effKey.current++
    setPenalties((p) => [...p, { key, ms }])
    setTimeout(() => setPenalties((p) => p.filter((x) => x.key !== key)), 1100)
  }

  const advance = () => {
    if (index + 1 >= ids.length) {
      const total = elapsed()
      pausedAt.current = now()
      onFinish({
        totalMs: total,
        rawMs: total - penaltyMs.current,
        errors: errors.current,
        skips: skips.current,
        missed: [...missed.current],
        ids,
      })
      return
    }
    setIndex((i) => i + 1)
  }

  const onRegion = (rid: string) => {
    if (!started || paused) return
    if (rid === id) {
      const ms = now() - lastFoundAt.current
      lastFoundAt.current = now()
      emit('answer', { mode: 'speedrun', kind: 'find', regionId: id, ok: true, ms, mapStyle })
      setFound((f) => [...f, id])
      addEffect(id, 'flash', 600)
      advance()
    } else if (!found.includes(rid)) {
      errors.current++
      missed.current.add(id)
      emit('answer', { mode: 'speedrun', kind: 'find', regionId: id, ok: false, mapStyle })
      addEffect(rid, 'shake', 900)
      penalize(PENALTY_MS)
    }
  }

  const skip = () => {
    if (!started || paused) return
    skips.current++
    missed.current.add(id)
    penalize(SKIP_PENALTY_MS)
    lastFoundAt.current = now()
    advance()
  }

  const pause = () => {
    if (!started || paused) return
    pausedAt.current = now()
    setPaused(true)
  }
  const resume = () => {
    if (pausedAt.current != null) {
      const d = now() - pausedAt.current
      t0.current += d
      lastFoundAt.current += d
    }
    pausedAt.current = null
    setPaused(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (paused) resume()
        else pause()
      } else if (e.key === ' ' && !paused) {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // найденные — лаймовые, чтобы не тыкать в них повторно
  const states = useMemo(() => {
    const st: Record<string, RegionState> = {}
    for (const f of found) st[f] = 'found'
    return st
  }, [found])

  const question = (
    <div className={`glass ${q.question} ${s.question}`} aria-live="polite">
      <div className={q.qBody}>
        <div className={q.kicker}>
          Найди · {Math.min(index + 1, ids.length)}/{ids.length}
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={started ? id : 'count'}
            className={`${q.name} ${region.name.length > 28 ? q.nameLong : ''}`}
            data-testid="q-name"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 520, damping: 36 }}
          >
            {started ? region.name : count > 0 ? `${count}…` : 'Старт!'}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={s.clockWrap}>
        <span ref={clock} className={s.clock}>
          0:00,0
        </span>
        <AnimatePresence>
          {penalties.map((p) => (
            <motion.span
              key={p.key}
              className={s.penalty}
              initial={{ opacity: 0, y: 0, scale: 0.8 }}
              animate={{ opacity: 1, y: -18, scale: 1 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              +{p.ms / 1000} с
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      {rival && (
        <span className={s.rival} title={`Время соперника: ${formatTime(rival.ms)}`}>
          <span ref={rivalBar} />
        </span>
      )}
      <span className={q.roundBar} style={{ width: `${(index / ids.length) * 100}%` }} />
    </div>
  )

  const panel = (
    <div className={q.actions}>
      <div className={q.statChips}>
        <span className={`chip ${q.badChip}`}>Ошибки {errors.current}</span>
        {rival && (
          <span className="chip">
            {rival.name}: {formatTime(rival.ms)}
          </span>
        )}
      </div>
      <button className="btn btn-ghost" onClick={skip} disabled={!started}>
        Пропустить +15 с
      </button>
    </div>
  )

  return (
    <>
      <MapLayout
        title="Спидран 89"
        onBack={pause}
        headerRight={<MapStyleToggle />}
        top={question}
        map={data && <MapView data={data} styleMode={mapStyle} states={states} effects={effects} onRegionClick={onRegion} cameraRef={camera} insetFrames />}
        insets={data && <Insets data={data} styleMode={mapStyle} states={states} effects={effects} onRegionClick={onRegion} />}
        panel={panel}
      />
      <Modal open={paused} onClose={resume} title="Пауза">
        <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Секундомер остановлен. Найдено {found.length} из {ids.length}.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-primary" onClick={resume} autoFocus>
            Продолжить
          </button>
          <button className="btn btn-ghost" onClick={onExit}>
            Сдаться и выйти
          </button>
        </div>
      </Modal>
    </>
  )
}
