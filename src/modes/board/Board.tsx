import { m as motion } from 'framer-motion'
import { useState } from 'react'
import { DISTRICT_BY_ID, REGION_BY_ID, type DistrictId } from '../../data/regions'
import { Icon } from '../../components/Icon'
import { emit } from '../../lib/events'
import { regionsOfScope, SCOPES } from '../../lib/quiz'
import { randomSeed, rng, shuffle } from '../../lib/random'
import { navigate } from '../../lib/router'
import { setState, updateSettings, useStore, type Settings } from '../../lib/store'
import { plural } from '../../lib/text'
import { BoardGame, type QResult } from './BoardGame'
import { Seg } from '../../components/Seg'
import { preferredCapital } from '../../lib/capitals'
import q from '../shared/Quiz.module.css'

interface BoardPrefs {
  size: 10 | 20 | 'all'
  scope: DistrictId | 'all'
}

const DEFAULT_PREFS: BoardPrefs = { size: 10, scope: 'all' }

type Stage = { k: 'setup' } | { k: 'play'; ids: string[]; key: number } | { k: 'results'; results: QResult[]; ids: string[] }

export function Board() {
  const rawPrefs = useStore((s) => s.boardPrefs as Partial<BoardPrefs> | undefined)
  const prefs: BoardPrefs = { ...DEFAULT_PREFS, ...rawPrefs }
  const settings = useStore((s) => s.settings)
  const [stage, setStage] = useState<Stage>({ k: 'setup' })

  const start = (ids?: string[]) => {
    const pool = ids ?? regionsOfScope(prefs.scope).map((r) => r.id)
    const order = shuffle(pool, rng(randomSeed()))
    const n = ids || prefs.size === 'all' ? order.length : Math.min(prefs.size, order.length)
    setStage({ k: 'play', ids: order.slice(0, n), key: Date.now() })
  }

  const finish = (results: QResult[], ids: string[]) => {
    const found = results.filter((r) => r.found)
    const caps = results.filter((r) => r.capAsked)
    const times = found.map((r) => r.findMs!).filter((x) => x != null)
    emit('round', {
      mode: 'board',
      ids: results.map((r) => r.id),
      regionOk: found.length,
      regionN: results.length,
      capOk: caps.filter((r) => r.capOk).length,
      capN: caps.length,
      perfectIds: results.filter((r) => r.found && r.capOk !== false).map((r) => r.id),
      avgMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      mapStyle: settings.mapStyle,
    })
    setStage({ k: 'results', results, ids })
  }

  if (stage.k === 'play')
    return (
      <BoardGame
        key={stage.key}
        ids={stage.ids}
        onFinish={(r) => finish(r, stage.ids)}
        onExit={() => setStage({ k: 'setup' })}
      />
    )
  if (stage.k === 'results')
    return (
      <Results
        results={stage.results}
        onRepeatMistakes={(ids) => start(ids)}
        onAgain={() => start()}
        onSetup={() => setStage({ k: 'setup' })}
      />
    )

  const setPrefs = (p: Partial<BoardPrefs>) => setState((s) => ({ boardPrefs: { ...DEFAULT_PREFS, ...((s.boardPrefs as BoardPrefs) ?? {}), ...p } }))
  const poolSize = regionsOfScope(prefs.scope).length

  return (
    <div className={q.setup}>
      <div className={q.setupInner}>
        <header className={q.setupHead}>
          <button className="icon-btn" aria-label="Назад" onClick={() => navigate('/')}>
            <Icon name="back" size={20} />
          </button>
          <h1>У доски</h1>
        </header>
        <p className={q.lead}>
          Как на зачёте: появляется название — найди регион на карте, пока идёт таймер, и сразу назови столицу. Не успел — пропуск.
        </p>

        <Section title="Сколько регионов">
          <Seg
            value={prefs.size !== 'all' && prefs.size < poolSize ? prefs.size : 'all'}
            options={[
              ...([10, 20] as const).filter((v) => v < poolSize).map((v) => ({ v, label: String(v) })),
              { v: 'all' as const, label: `Все ${poolSize}` },
            ]}
            onChange={(v) => setPrefs({ size: v })}
          />
        </Section>

        <Section title="Какие регионы">
          <Seg
            value={prefs.scope}
            options={SCOPES.map((s) => ({ v: s.id, label: s.label }))}
            onChange={(v) => setPrefs({ scope: v })}
          />
        </Section>

        <Section title="Таймер на поиск">
          <Seg
            value={settings.timerSec}
            options={[
              { v: 5 as const, label: '5 с' },
              { v: 7 as const, label: '7 с' },
              { v: 10 as const, label: '10 с' },
              { v: 0 as const, label: 'Без таймера' },
            ]}
            onChange={(v) => updateSettings({ timerSec: v as Settings['timerSec'] })}
          />
        </Section>

        <Section title="Столица">
          <Seg
            value={settings.capitalInput}
            options={[
              { v: 'choice' as const, label: '4 варианта' },
              { v: 'typing' as const, label: 'Ввод с клавиатуры' },
            ]}
            onChange={(v) => updateSettings({ capitalInput: v })}
          />
        </Section>

        <Section title="Карта">
          <Seg
            value={settings.mapStyle}
            options={[
              { v: 'board' as const, label: 'Как на доске' },
              { v: 'study' as const, label: 'Учебная' },
            ]}
            onChange={(v) => updateSettings({ mapStyle: v })}
          />
          <p className={q.lead} style={{ fontSize: 13, marginTop: 10 }}>
            «Как на доске» — физическая карта без подписей и с еле заметными границами. Перед зачётом тренируйся на ней.
          </p>
        </Section>

        <motion.button className={`btn btn-primary ${q.startBtn}`} whileTap={{ scale: 0.97 }} onClick={() => start()}>
          <Icon name="play" size={18} /> Начать
        </motion.button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`glass ${q.section}`}>
      <h2 className={q.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function Results({
  results,
  onRepeatMistakes,
  onAgain,
  onSetup,
}: {
  results: QResult[]
  onRepeatMistakes: (ids: string[]) => void
  onAgain: () => void
  onSetup: () => void
}) {
  const n = results.length
  const found = results.filter((r) => r.found)
  const caps = results.filter((r) => r.capAsked)
  const capOk = caps.filter((r) => r.capOk).length
  const times = found.map((r) => r.findMs!).filter((x) => x != null)
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null
  const mistakes = results.filter((r) => !r.found || r.capOk === false)
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
  const capPrefs = useStore((s) => s.settings.capitalPrefs)

  return (
    <div className={q.setup}>
      <div className={`${q.setupInner} ${q.results}`}>
        <header className={q.setupHead}>
          <button className="icon-btn" aria-label="Назад" onClick={() => navigate('/')}>
            <Icon name="back" size={20} />
          </button>
          <h1>Итоги раунда</h1>
        </header>
        <div className={q.bigStats}>
          <Stat value={`${pct(found.length, n)}%`} label={`Регионы ${found.length}/${n}`} />
          <Stat value={caps.length ? `${pct(capOk, caps.length)}%` : '—'} label={`Столицы ${capOk}/${caps.length}`} />
          <Stat value={avg != null ? `${(avg / 1000).toFixed(1).replace(".", ",")} с` : '—'} label="Среднее время поиска" />
        </div>

        {mistakes.length ? (
          <section className={`glass ${q.section}`}>
            <h2 className={q.sectionTitle}>
              {mistakes.length} {plural(mistakes.length, ['ошибка', 'ошибки', 'ошибок'])}
            </h2>
            <ul className={q.mistakes}>
              {mistakes.map((m) => {
                const r = REGION_BY_ID[m.id]
                const what = !m.found
                  ? m.skipped
                    ? 'пропуск'
                    : `указал ${REGION_BY_ID[m.tapped!]?.short ?? '?'}`
                  : `столица: ${m.capAnswer ?? 'не успел'} → ${preferredCapital(r, capPrefs)}`
                return (
                  <li key={m.id}>
                    <span>
                      <span className={q.mName}>{r.name}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{DISTRICT_BY_ID[r.district].short}</span>
                    </span>
                    <span className={q.mWhat}>{what}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : (
          <section className={`glass ${q.section}`} style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 22 }}>Без единой ошибки!</h2>
            <p className={q.lead}>Учитель доволен. Попробуй больше регионов или таймер 5 с.</p>
          </section>
        )}

        <div className={q.resultActions}>
          {mistakes.length > 0 && (
            <button className={`btn btn-primary ${q.full}`} onClick={() => onRepeatMistakes(mistakes.map((m) => m.id))}>
              <Icon name="refresh" size={18} /> Повторить ошибки
            </button>
          )}
          <button className={`btn ${mistakes.length ? 'btn-ghost' : 'btn-primary'}`} onClick={onAgain}>
            Ещё раунд
          </button>
          <button className="btn btn-ghost" onClick={onSetup}>
            Настройки
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={`glass ${q.bigStat}`}>
      <div className={q.bigNum}>{value}</div>
      <div className={q.bigLabel}>{label}</div>
    </div>
  )
}
