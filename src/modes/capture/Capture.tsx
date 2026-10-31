import { motion } from 'framer-motion'
import { useState } from 'react'
import { DISTRICTS, REGION_BY_ID, type DistrictId } from '../../data/regions'
import { Icon } from '../../components/Icon'
import { ProgressRing } from '../../components/ProgressRing'
import { emit } from '../../lib/events'
import { districtProgress, dueCount, startSession, useCapture, CAPTURED_LEVEL } from '../../lib/leitner'
import { navigate } from '../../lib/router'
import { setState, useStore } from '../../lib/store'
import { plural } from '../../lib/text'
import { Seg } from '../board/Board'
import { CaptureGame, type CaptureSummary } from './CaptureGame'
import q from '../shared/Quiz.module.css'
import c from './Capture.module.css'

type Stage = { k: 'intro' } | { k: 'play'; session: number; key: number } | { k: 'done'; summary: CaptureSummary }

export function Capture() {
  const capture = useCapture()
  const scope = useStore((s) => (s.captureScope as DistrictId | 'all' | undefined) ?? 'all')
  const mapStyle = useStore((s) => s.settings.mapStyle)
  const [length, setLength] = useState(15)
  const [stage, setStage] = useState<Stage>({ k: 'intro' })

  const start = () => setStage({ k: 'play', session: startSession(), key: Date.now() })

  if (stage.k === 'play')
    return (
      <CaptureGame
        key={stage.key}
        scope={scope}
        session={stage.session}
        length={length}
        onExit={() => setStage({ k: 'intro' })}
        onFinish={(summary) => {
          emit('round', {
            mode: 'capture',
            ids: [],
            regionOk: summary.ok,
            regionN: summary.asked,
            capOk: 0,
            capN: 0,
            perfectIds: [],
            avgMs: null,
            mapStyle,
          })
          setStage({ k: 'done', summary })
        }}
      />
    )

  const prog = districtProgress(capture)
  const captured = Object.values(capture.cards).filter((x) => x.level >= CAPTURED_LEVEL).length
  const learning = Object.values(capture.cards).filter((x) => x.level > 0 && x.level < CAPTURED_LEVEL).length
  const due = dueCount(capture)

  return (
    <div className={q.setup}>
      <div className={q.setupInner}>
        <header className={q.setupHead}>
          <button className="icon-btn" aria-label="Назад" onClick={() => navigate('/')}>
            <Icon name="back" size={20} />
          </button>
          <h1>Захват карты</h1>
        </header>

        {stage.k === 'done' && <SessionDone summary={stage.summary} />}

        <section className={`glass ${c.hero}`}>
          <ProgressRing value={captured} max={89} size={92} stroke={9} />
          <div>
            <div className={c.heroNum}>
              {captured}
              <span>/89</span>
            </div>
            <p className={q.lead} style={{ fontSize: 14 }}>
              захвачено · {learning} в изучении{due ? ` · ${due} ждут повторения` : ''}
            </p>
          </div>
        </section>

        <section className={`glass ${q.section}`}>
          <h2 className={q.sectionTitle}>Где захватываем</h2>
          <div className={c.districts}>
            <DistrictButton label="Вся Россия" done={captured} total={89} active={scope === 'all'} onClick={() => setState({ captureScope: 'all' })} />
            {DISTRICTS.map((d) => (
              <DistrictButton
                key={d.id}
                label={d.short}
                color={`var(--d-${d.id})`}
                done={prog[d.id].done}
                total={prog[d.id].total}
                active={scope === d.id}
                onClick={() => setState({ captureScope: d.id })}
              />
            ))}
          </div>
          <p className={q.lead} style={{ fontSize: 13, marginTop: 10 }}>
            Начни с одного округа: камера приблизится к нему, остальная карта станет приглушённой.
          </p>
        </section>

        <section className={`glass ${q.section}`}>
          <h2 className={q.sectionTitle}>Длина сессии</h2>
          <Seg value={length} options={[{ v: 10, label: '10' }, { v: 15, label: '15' }, { v: 30, label: '30' }]} onChange={setLength} />
          <p className={q.lead} style={{ fontSize: 13, marginTop: 10 }}>
            Регион захвачен, когда ты верно назовёшь место и столицу 4 раза с перерывами: сразу, через несколько вопросов, в следующий раз и через день. Ошибки возвращаются чаще.
          </p>
        </section>

        <motion.button className={`btn btn-primary ${q.startBtn}`} whileTap={{ scale: 0.97 }} onClick={start}>
          <Icon name="flag" size={18} /> {captured || learning ? 'Продолжить захват' : 'Начать захват'}
        </motion.button>
      </div>
    </div>
  )
}

function DistrictButton(props: { label: string; color?: string; done: number; total: number; active: boolean; onClick: () => void }) {
  const pct = props.total ? props.done / props.total : 0
  return (
    <button className={c.district} aria-pressed={props.active} onClick={props.onClick}>
      <span className={c.dLabel}>
        {props.color && <span className={c.dDot} style={{ background: props.color }} />}
        {props.label}
      </span>
      <span className={c.dCount}>
        {props.done}/{props.total}
      </span>
      <span className={c.dBar}>
        <span style={{ width: `${pct * 100}%` }} />
      </span>
    </button>
  )
}

function SessionDone({ summary }: { summary: CaptureSummary }) {
  return (
    <motion.section
      className={`glass ${q.section} ${c.done}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <h2 style={{ fontSize: 20 }}>Сессия завершена</h2>
      <p className={q.lead}>
        Верно {summary.ok} из {summary.asked}.{' '}
        {summary.captured.length
          ? `Захвачено ${summary.captured.length} ${plural(summary.captured.length, ['новый регион', 'новых региона', 'новых регионов'])}: ${summary.captured.map((id) => REGION_BY_ID[id].short).join(', ')}.`
          : 'Новых захватов пока нет — регионы на подходе, возвращайся завтра для следующего уровня.'}
        {summary.lost.length ? ` Нужно повторить: ${summary.lost.map((id) => REGION_BY_ID[id].short).join(', ')}.` : ''}
      </p>
    </motion.section>
  )
}
