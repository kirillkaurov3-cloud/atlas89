import { AnimatePresence, m as motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { REGION_BY_ID } from '../../data/regions'
import { Icon } from '../../components/Icon'
import { MapLayout } from '../../components/MapLayout'
import { Modal } from '../../components/Modal'
import { Insets } from '../../map/Insets'
import { MapView, type MapCamera, type MapEffect, type RegionState } from '../../map/MapView'
import { MapStyleToggle } from '../../map/MapStyleToggle'
import { useMapData } from '../../map/useMapData'
import { preferredCapital } from '../../lib/capitals'
import { emit } from '../../lib/events'
import { capitalOptions, isCapitalCorrect } from '../../lib/quiz'
import { useStore } from '../../lib/store'
import { CapitalTyping, Choices } from '../shared/CapitalAnswer'
import { CountdownRing } from '../shared/CountdownRing'
import q from '../shared/Quiz.module.css'
import { useIsPhone } from '../../lib/media'

export interface QResult {
  id: string
  found: boolean
  skipped: boolean
  findMs: number | null
  tapped?: string
  capAsked: boolean
  capOk: boolean | null
  capAnswer?: string
}

type Phase =
  | { k: 'find'; startedAt: number }
  | { k: 'findFb'; ok: boolean; tapped?: string; skipped?: boolean }
  | { k: 'capital'; startedAt: number; options: string[] }
  | { k: 'capFb'; ok: boolean; chosen: string | null }

const CAPITAL_MS = 5000
const OK_DELAY = 750
const MISS_FLY_MS = 1200
const MISS_HOLD_MS = 700
const CAP_OK_DELAY = 850
const CAP_BAD_DELAY = 1700

interface Props {
  ids: string[]
  onFinish: (results: QResult[]) => void
  onExit: () => void
}

export function BoardGame({ ids, onFinish, onExit }: Props) {
  const data = useMapData()
  const settings = useStore((s) => s.settings)
  const findMs = settings.timerSec * 1000
  const camera = useRef<MapCamera>(null)
  const savedView = useRef<ReturnType<MapCamera['getView']> | null>(null)

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(() => ({ k: 'find', startedAt: performance.now() }))
  const [results, setResults] = useState<QResult[]>([])
  const resultsRef = useRef(results)
  resultsRef.current = results
  const [effects, setEffects] = useState<MapEffect[]>([])
  const [paused, setPaused] = useState<number | null>(null)
  const [typed, setTyped] = useState<{ ok: boolean; correct: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const effKey = useRef(0)

  const id = ids[index]
  const region = REGION_BY_ID[id]
  const correctCapital = preferredCapital(region, settings.capitalPrefs)

  const addEffect = (rid: string, kind: MapEffect['kind'], ttl = 1600) => {
    const key = `e${effKey.current++}`
    setEffects((e) => [...e, { key, id: rid, kind }])
    setTimeout(() => setEffects((e) => e.filter((x) => x.key !== key)), ttl)
  }

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const patchResult = (patch: Partial<QResult>) =>
    setResults((rs) => {
      const cur = rs[index] ?? { id, found: false, skipped: false, findMs: null, capAsked: false, capOk: null }
      const next = rs.slice()
      next[index] = { ...cur, ...patch }
      return next
    })

  // ---------- Переходы ----------
  const next = useCallback(() => {
    clearTimer()
    setTyped(null)
    if (savedView.current) {
      camera.current?.setView(savedView.current, 600)
      savedView.current = null
    }
    if (index + 1 >= ids.length) {
      onFinish(resultsRef.current.filter(Boolean))
      return
    }
    setIndex((i) => i + 1)
    setPhase({ k: 'find', startedAt: performance.now() })
  }, [index, ids.length, onFinish])

  const startCapital = useCallback(() => {
    if (!region.capital) return next()
    setPhase({ k: 'capital', startedAt: performance.now(), options: capitalOptions(region, settings.capitalPrefs) })
    patchResult({ capAsked: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, settings.capitalPrefs, next])

  const miss = (tapped?: string) => {
    const skipped = !tapped
    setPhase({ k: 'findFb', ok: false, tapped, skipped })
    patchResult({ found: false, skipped, tapped, findMs: null })
    emit('answer', { mode: 'board', kind: 'find', regionId: id, ok: false, mapStyle: settings.mapStyle })
    if (tapped) addEffect(tapped, 'shake', 1200)
    // камера плавно летит к правильному региону
    savedView.current = camera.current?.getView() ?? null
    camera.current?.flyTo(id, { duration: MISS_FLY_MS, fill: 0.45, maxZoom: 10 })
  }

  const onRegion = (rid: string) => {
    if (phase.k !== 'find' || paused != null) return
    const ms = performance.now() - phase.startedAt
    if (rid === id) {
      setPhase({ k: 'findFb', ok: true })
      patchResult({ found: true, findMs: ms })
      emit('answer', { mode: 'board', kind: 'find', regionId: id, ok: true, ms, mapStyle: settings.mapStyle })
      addEffect(id, 'flash', 800)
      addEffect(id, 'trace', 2200)
    } else miss(rid)
  }

  const answerCapital = (value: string | null) => {
    if (phase.k !== 'capital') return
    const ok = value != null && isCapitalCorrect(value, region)
    setPhase({ k: 'capFb', ok, chosen: value })
    patchResult({ capOk: ok, capAnswer: value ?? undefined })
    emit('answer', { mode: 'board', kind: 'capital', regionId: id, ok, mapStyle: settings.mapStyle })
    if (settings.capitalInput === 'typing') setTyped({ ok, correct: correctCapital ?? '' })
  }

  // ---------- Таймеры фаз ----------
  useEffect(() => {
    clearTimer()
    if (paused != null) return
    const now = performance.now()
    if (phase.k === 'find' && findMs > 0) {
      timer.current = setTimeout(() => miss(), Math.max(0, findMs - (now - phase.startedAt)))
    } else if (phase.k === 'capital') {
      timer.current = setTimeout(() => answerCapital(null), Math.max(0, CAPITAL_MS - (now - phase.startedAt)))
    } else if (phase.k === 'findFb') {
      if (phase.ok) timer.current = setTimeout(startCapital, OK_DELAY)
      else timer.current = setTimeout(next, MISS_FLY_MS + MISS_HOLD_MS)
    } else if (phase.k === 'capFb') {
      timer.current = setTimeout(next, phase.ok ? CAP_OK_DELAY : CAP_BAD_DELAY)
    }
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused])

  // ---------- Пауза ----------
  const pause = () => {
    if (paused == null) setPaused(performance.now())
  }
  const resume = () => {
    if (paused == null) return
    const shift = performance.now() - paused
    setPhase((p) => (p.k === 'find' || p.k === 'capital' ? { ...p, startedAt: p.startedAt + shift } : { ...p }))
    setPaused(null)
  }

  // ---------- Горячие клавиши ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') {
        if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (paused != null) resume()
        else pause()
      } else if (e.key === ' ' && paused == null) {
        e.preventDefault()
        if (phase.k === 'find') miss()
        else if (phase.k === 'findFb') {
          if (phase.ok) startCapital()
          else next()
        } else if (phase.k === 'capFb') next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------- Состояния карты ----------
  const states = useMemo(() => {
    const st: Record<string, RegionState> = {}
    if (phase.k === 'findFb') {
      if (phase.ok) st[id] = 'correct'
      else {
        st[id] = 'target'
        if (phase.tapped) st[phase.tapped] = 'wrong'
      }
    } else if (phase.k === 'capital' || phase.k === 'capFb') {
      st[id] = results[index]?.found ? 'correct' : 'target'
    }
    return st
  }, [phase, id, results, index])

  const done = results.filter(Boolean)
  const okCount = done.filter((r) => r.found).length
  const capCount = done.filter((r) => r.capOk).length
  const isCapital = phase.k === 'capital' || phase.k === 'capFb'
  const isPhone = useIsPhone()
  const longName = region.name.length > 28

  // запоминаем варианты, чтобы показать их и после ответа
  const lastOptions = useRef<string[]>([])
  if (phase.k === 'capital') lastOptions.current = phase.options

  const question = (
    <div className={`glass ${q.question}`} aria-live="polite">
      <CountdownRing
        startedAt={phase.k === 'find' || phase.k === 'capital' ? phase.startedAt : null}
        duration={phase.k === 'capital' ? CAPITAL_MS : findMs}
        paused={paused != null}
        size={62}
      />
      <div className={q.qBody}>
        <div className={q.kicker}>{isCapital ? 'Назови столицу' : 'Найди на карте'}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={id}
            className={`${q.name} ${longName ? q.nameLong : ''}`}
            data-testid="q-name"
            initial={{ opacity: 0, scale: 1.08, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ transformOrigin: 'left center' }}
          >
            {region.name}
          </motion.div>
        </AnimatePresence>
        <Feedback phase={phase} tappedName={phase.k === 'findFb' && phase.tapped ? REGION_BY_ID[phase.tapped]?.name : undefined} capital={correctCapital} />
      </div>
      <span className={q.counter}>
        {index + 1}/{ids.length}
      </span>
      <span className={q.roundBar} style={{ width: `${((index + (phase.k === 'find' ? 0 : 1)) / ids.length) * 100}%` }} />
    </div>
  )

  const panel = (
    <div className={q.panel}>
      {isCapital ? (
        settings.capitalInput === 'typing' ? (
          <CapitalTyping key={id} onSubmit={answerCapital} result={typed} />
        ) : (
          <Choices
            key={id}
            options={phase.k === 'capital' ? phase.options : lastOptions.current}
            chosen={phase.k === 'capFb' ? phase.chosen : null}
            correct={phase.k === 'capFb' ? correctCapital : null}
            onPick={answerCapital}
          />
        )
      ) : (
        <div className={q.actions}>
          <div className={q.statChips}>
            <span className={`chip ${q.okChip}`}>
              <Icon name="check" size={14} /> {okCount}
            </span>
            <span className="chip">Столицы {capCount}</span>
          </div>
          <button className="btn btn-ghost" onClick={() => phase.k === 'find' && miss()} disabled={phase.k !== 'find'}>
            Пропустить <span className="kbd">Space</span>
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      <MapLayout
        title="У доски"
        onBack={pause}
        headerRight={<MapStyleToggle />}
        top={question}
        map={
          data && (
            <MapView data={data} styleMode={settings.mapStyle} states={states} effects={effects} onRegionClick={onRegion} cameraRef={camera} insetFrames />
          )
        }
        insets={data && !(isCapital && isPhone) && <Insets data={data} styleMode={settings.mapStyle} states={states} effects={effects} onRegionClick={onRegion} />}
        panel={panel}
      />
      <Modal open={paused != null} onClose={resume} title="Пауза">
        <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
          Пройдено {done.length} из {ids.length}. Таймер остановлен.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-primary" onClick={resume} autoFocus>
            Продолжить
          </button>
          <button className="btn btn-ghost" onClick={() => onFinish(done)} disabled={!done.length}>
            Завершить и посмотреть итоги
          </button>
          <button className="btn btn-ghost" onClick={onExit}>
            Выйти в меню
          </button>
        </div>
      </Modal>
    </>
  )
}

function Feedback({ phase, tappedName, capital }: { phase: Phase; tappedName?: string; capital: string | null }) {
  let text: string | null = null
  let cls = ''
  if (phase.k === 'findFb') {
    if (phase.ok) {
      text = 'Верно!'
      cls = q.ok
    } else if (phase.skipped) {
      text = 'Пропуск — вот где он'
      cls = q.bad
    } else {
      text = `Это ${tappedName ?? 'другой регион'}`
      cls = q.bad
    }
  } else if (phase.k === 'capFb') {
    text = phase.ok ? `Верно, ${capital}` : phase.chosen ? `Нет, столица — ${capital}` : `Время! Столица — ${capital}`
    cls = phase.ok ? q.ok : q.bad
  }
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text}
          className={`${q.feedback} ${cls}`}
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
