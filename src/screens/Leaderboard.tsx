import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { leaderboard, mineIds, type LbPeriod, type ScoreRow } from '../leaderboard/service'
import { navigate } from '../lib/router'
import { formatTime } from '../lib/share'
import { useStore } from '../lib/store'
import { Seg } from '../components/Seg'
import s from './Leaderboard.module.css'

/** Топ-50 спидрана за неделю и за всё время. Экран существует только при включённой таблице. */
export function Leaderboard() {
  const [period, setPeriod] = useState<LbPeriod>('week')
  const [rows, setRows] = useState<ScoreRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nickname = useStore((st) => st.profile.nickname)

  useEffect(() => {
    if (!leaderboard.enabled) return
    let alive = true
    setRows(null)
    setError(null)
    leaderboard
      .top('speedrun', period, 50)
      .then((r) => alive && setRows(r))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [period])

  if (!leaderboard.enabled) {
    return (
      <div className={s.page}>
        <p className={s.msg}>Таблица лидеров пока выключена.</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    )
  }

  const mine = mineIds()
  const isMine = (r: ScoreRow) => mine.has(r.id) || (!!nickname && r.nickname.toLowerCase() === nickname.toLowerCase())

  return (
    <div className={s.page}>
      <header className={s.head}>
        <button className="icon-btn" aria-label="Назад" onClick={() => history.length > 1 ? history.back() : navigate('/')}>
          <Icon name="back" size={20} />
        </button>
        <h1>Таблица лидеров</h1>
      </header>
      <p className={s.lead}>Спидран 89 — лучшие результаты (по одному на ник).</p>
      <Seg
        value={period}
        options={[
          { v: 'week' as const, label: 'За неделю' },
          { v: 'all' as const, label: 'За всё время' },
        ]}
        onChange={setPeriod}
      />
      <section className={`glass ${s.table}`}>
        {error && <p className={s.msg}>Не удалось загрузить: {error}. Если таблицей давно не пользовались, сервер мог «уснуть» — попробуй через минуту.</p>}
        {!error && rows == null && <p className={s.msg}>Загрузка…</p>}
        {!error && rows?.length === 0 && <p className={s.msg}>Пока пусто. Пройди спидран — и стань первым!</p>}
        {rows && rows.length > 0 && (
          <ol className={s.list}>
            {rows.map((r, i) => (
              <li key={r.id} className={`${s.row} ${isMine(r) ? s.mine : ''} ${i < 3 ? s.podium : ''}`}>
                <span className={s.place}>{i + 1}</span>
                <span className={s.nick}>{r.nickname}</span>
                <span className={s.acc}>{Math.round(r.accuracy)}%</span>
                <span className={s.time}>{formatTime(r.time_ms)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
