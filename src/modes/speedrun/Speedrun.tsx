import { m as motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { leaderboard, rememberMine } from '../../leaderboard/service'
import { REGIONS, REGION_BY_ID } from '../../data/regions'
import { APP_NAME } from '../../config'
import { Icon } from '../../components/Icon'
import { emit } from '../../lib/events'
import { randomSeed, rng, shuffle } from '../../lib/random'
import { absoluteUrl, navigate, useRoute } from '../../lib/router'
import { formatTime, shareLink } from '../../lib/share'
import { getState, setState, updateProfile, updateSettings, useStore } from '../../lib/store'
import { plural } from '../../lib/text'
import { Seg } from '../../components/Seg'
import { PENALTY_MS, SpeedrunGame, type SpeedrunResult } from './SpeedrunGame'
import q from '../shared/Quiz.module.css'
import s from './Speedrun.module.css'

export interface SpeedrunStore {
  best?: number
  bestAt?: number
  runs?: number
}

const NO_RUNS: SpeedrunStore = {}

/** Один и тот же seed → один и тот же порядок регионов на любом устройстве. */
export function orderFor(seed: number): string[] {
  return shuffle(
    REGIONS.map((r) => r.id),
    rng(seed),
  )
}

interface Challenge {
  seed: number
  ms: number
  name: string
}

function parseChallenge(query: URLSearchParams): Challenge | null {
  const seed = Number(query.get('seed'))
  const t = Number(String(query.get('t') ?? '').replace(',', '.'))
  const name = (query.get('n') ?? '').trim().slice(0, 20) || 'Друг'
  if (!Number.isFinite(seed) || seed <= 0 || !Number.isFinite(t) || t <= 0) return null
  return { seed: Math.floor(seed), ms: t * 1000, name }
}

type Stage = { k: 'intro' } | { k: 'play'; seed: number; key: number } | { k: 'result'; seed: number; result: SpeedrunResult; prevBest?: number }

export function Speedrun() {
  const route = useRoute()
  const challenge = useMemo(() => (route.path === '/challenge' ? parseChallenge(route.query) : null), [route])
  const [stage, setStage] = useState<Stage>({ k: 'intro' })
  const mapStyle = useStore((st) => st.settings.mapStyle)
  const sr = useStore((st) => (st.speedrun as SpeedrunStore | undefined) ?? NO_RUNS)

  const start = (seed = challenge?.seed ?? randomSeed()) => setStage({ k: 'play', seed, key: Date.now() })

  if (stage.k === 'play')
    return (
      <SpeedrunGame
        key={stage.key}
        ids={orderFor(stage.seed)}
        rival={challenge && challenge.seed === stage.seed ? { name: challenge.name, ms: challenge.ms } : undefined}
        onExit={() => setStage({ k: 'intro' })}
        onFinish={(result) => {
          const prev = (getState().speedrun as SpeedrunStore | undefined) ?? {}
          const isBest = prev.best == null || result.totalMs < prev.best
          setState({
            speedrun: {
              ...prev,
              runs: (prev.runs ?? 0) + 1,
              ...(isBest ? { best: result.totalMs, bestAt: Date.now() } : {}),
            },
          })
          emit('round', {
            mode: 'speedrun',
            ids: result.ids,
            regionOk: result.ids.length - result.missed.length,
            regionN: result.ids.length,
            capOk: 0,
            capN: 0,
            perfectIds: result.ids.filter((x) => !result.missed.includes(x)),
            avgMs: result.rawMs / result.ids.length,
            totalMs: result.totalMs,
            mapStyle,
          })
          setStage({ k: 'result', seed: stage.seed, result, prevBest: prev.best })
        }}
      />
    )

  if (stage.k === 'result')
    return (
      <Result
        seed={stage.seed}
        result={stage.result}
        prevBest={stage.prevBest}
        challenge={challenge && challenge.seed === stage.seed ? challenge : null}
        onAgain={() => start(randomSeed())}
        onSame={() => start(stage.seed)}
      />
    )

  return (
    <div className={q.setup}>
      <div className={q.setupInner}>
        <header className={q.setupHead}>
          <button className="icon-btn" aria-label="Назад" onClick={() => navigate('/')}>
            <Icon name="back" size={20} />
          </button>
          <h1>{challenge ? 'Вызов!' : 'Спидран 89'}</h1>
        </header>

        {challenge ? (
          <motion.section
            className={`glass ${s.challengeCard}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <p className={s.challengeKicker}>{challenge.name} бросает тебе вызов</p>
            <div className={s.bigTime}>{formatTime(challenge.ms)}</div>
            <p className={q.lead}>Тот же порядок всех 89 регионов. Обгони!</p>
          </motion.section>
        ) : (
          <p className={q.lead}>
            Все 89 регионов в случайном порядке на время. Подсказок нет, каждая ошибка — +{PENALTY_MS / 1000} с. В конце можно бросить вызов другу: он
            пройдёт тот же порядок.
          </p>
        )}

        {leaderboard.enabled && (
          <button className="btn btn-ghost" onClick={() => navigate('/leaderboard')}>
            <Icon name="trophy" size={18} /> Таблица лидеров
          </button>
        )}

        {sr.best != null && (
          <section className={`glass ${q.section} ${s.bestRow}`}>
            <Icon name="trophy" size={20} />
            <span>
              Твой рекорд: <strong>{formatTime(sr.best)}</strong>
            </span>
            {sr.runs ? <span className={s.runs}>{sr.runs} {plural(sr.runs, ['забег', 'забега', 'забегов'])}</span> : null}
          </section>
        )}

        <section className={`glass ${q.section}`}>
          <h2 className={q.sectionTitle}>Карта</h2>
          <Seg
            value={mapStyle}
            options={[
              { v: 'board' as const, label: 'Как на доске' },
              { v: 'study' as const, label: 'Учебная' },
            ]}
            onChange={(v) => updateSettings({ mapStyle: v })}
          />
          <p className={q.lead} style={{ fontSize: 13, marginTop: 10 }}>
            Мелкие регионы удобнее искать на врезках под картой или приблизив карту.
          </p>
        </section>

        <motion.button className={`btn btn-primary ${q.startBtn}`} whileTap={{ scale: 0.97 }} onClick={() => start()}>
          <Icon name="bolt" size={18} /> {challenge ? 'Принять вызов' : 'Старт'}
        </motion.button>
        {challenge && (
          <button className="btn btn-ghost" onClick={() => navigate('/speedrun', { replace: true })}>
            Обычный спидран
          </button>
        )}
      </div>
    </div>
  )
}

function Result({
  seed,
  result,
  prevBest,
  challenge,
  onAgain,
  onSame,
}: {
  seed: number
  result: SpeedrunResult
  prevBest?: number
  challenge: Challenge | null
  onAgain: () => void
  onSame: () => void
}) {
  const nickname = useStore((st) => st.profile.nickname)
  const [nick, setNick] = useState(nickname ?? '')
  const isRecord = prevBest == null || result.totalMs < prevBest
  const diff = challenge ? result.totalMs - challenge.ms : 0
  const [lb, setLb] = useState<{ state: 'idle' | 'sending' | 'done' | 'error'; msg?: string }>({ state: 'idle' })
  const submitted = useRef(false)

  const submit = async (name: string) => {
    if (!leaderboard.enabled || submitted.current) return
    if (name.length < 2) return setLb({ state: 'error', msg: 'Ник — от 2 символов' })
    submitted.current = true
    setLb({ state: 'sending' })
    try {
      const row = await leaderboard.submit({
        nickname: name,
        mode: 'speedrun',
        time_ms: result.totalMs,
        accuracy: ((result.ids.length - result.missed.length) / result.ids.length) * 100,
      })
      if (row) rememberMine(row.id)
      setLb({ state: 'done' })
    } catch (e) {
      submitted.current = false
      setLb({ state: 'error', msg: (e as Error).message })
    }
  }

  // ник уже есть — отправляем автоматически
  useEffect(() => {
    if (nickname) void submit(nickname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const share = async () => {
    const name = nick.trim().slice(0, 20)
    if (name && name !== nickname) updateProfile({ nickname: name, nickAsked: true })
    const t = (result.totalMs / 1000).toFixed(1)
    const url = absoluteUrl(`/challenge?seed=${seed}&t=${t}${name ? `&n=${encodeURIComponent(name)}` : ''}`)
    await shareLink(url, `Я прошёл все 89 регионов России за ${formatTime(result.totalMs)} в «${APP_NAME}». Сможешь быстрее?`)
  }

  return (
    <div className={q.setup}>
      <div className={`${q.setupInner} ${q.results}`}>
        <header className={q.setupHead}>
          <button className="icon-btn" aria-label="На главную" onClick={() => navigate('/')}>
            <Icon name="back" size={20} />
          </button>
          <h1>Финиш!</h1>
        </header>

        <motion.section
          className={s.resultCard}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <div className={s.resultInner}>
            <div className={s.resultTop}>
              <span className={s.brand}>{APP_NAME} · Спидран</span>
              {isRecord && <span className={s.recordBadge}>Рекорд!</span>}
            </div>
            <div className={s.resultTime}>{formatTime(result.totalMs)}</div>
            <div className={s.resultMeta}>
              <span>89 регионов</span>
              <span>
                {result.errors} {plural(result.errors, ['ошибка', 'ошибки', 'ошибок'])}
              </span>
              {result.skips > 0 && <span>{result.skips} пропуск.</span>}
              <span>чистое {formatTime(result.rawMs)}</span>
            </div>
            {challenge && (
              <div className={`${s.versus} ${diff < 0 ? s.win : s.lose}`}>
                {diff < 0
                  ? `Ты быстрее, чем ${challenge.name}, на ${formatTime(-diff)}!`
                  : diff === 0
                    ? `Ничья с ${challenge.name}!`
                    : `${challenge.name} быстрее на ${formatTime(diff)}. Попробуй ещё!`}
              </div>
            )}
            {!isRecord && prevBest != null && <div className={s.prevBest}>Рекорд: {formatTime(prevBest)}</div>}
          </div>
        </motion.section>

        <section className={`glass ${q.section}`}>
          <h2 className={q.sectionTitle}>Бросить вызов</h2>
          <div className={s.shareRow}>
            <input
              className={s.nickInput}
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Твоё имя (необязательно)"
              maxLength={20}
              aria-label="Имя в ссылке-вызове"
            />
            <button className="btn btn-violet" onClick={share}>
              <Icon name="share" size={18} /> Бросить вызов
            </button>
          </div>
          <p className={q.lead} style={{ fontSize: 13, marginTop: 8 }}>
            Друг откроет ссылку, пройдёт тот же порядок регионов и увидит, чей результат лучше. Сервер не нужен.
          </p>
        </section>

        {leaderboard.enabled && (
          <section className={`glass ${q.section}`}>
            <h2 className={q.sectionTitle}>Таблица лидеров</h2>
            {lb.state === 'done' ? (
              <p className={q.lead}>Результат в таблице лидеров!</p>
            ) : lb.state === 'sending' ? (
              <p className={q.lead}>Отправляем…</p>
            ) : (
              <>
                {lb.state === 'error' && <p className={q.lead} style={{ color: 'var(--coral)', marginBottom: 8 }}>{lb.msg}</p>}
                <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => submit(nick.trim().slice(0, 20))}>
                  {nick.trim() ? `Отправить как «${nick.trim()}»` : 'Впиши имя выше и отправь'}
                </button>
              </>
            )}
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/leaderboard')}>
              <Icon name="trophy" size={18} /> Открыть таблицу
            </button>
          </section>
        )}

        {result.missed.length > 0 && (
          <section className={`glass ${q.section}`}>
            <h2 className={q.sectionTitle}>Где споткнулся</h2>
            <div className={s.missed}>
              {result.missed.map((id) => (
                <span key={id} className="chip">
                  {REGION_BY_ID[id].short}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className={q.resultActions}>
          <button className="btn btn-primary" onClick={onAgain}>
            Новый забег
          </button>
          <button className="btn btn-ghost" onClick={onSame}>
            Тот же порядок
          </button>
        </div>
      </div>
    </div>
  )
}
