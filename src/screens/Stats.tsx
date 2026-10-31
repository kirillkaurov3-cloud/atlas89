import { m as motion } from 'framer-motion'
import { DISTRICTS, REGIONS, REGION_BY_ID } from '../data/regions'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { ACHIEVEMENTS, useUnlocked } from '../lib/achievements'
import { districtProgress, useCapture, CAPTURED_LEVEL } from '../lib/leitner'
import { dayStreak, difficulty, useStats } from '../lib/progress'
import { navigate } from '../lib/router'
import { formatTime } from '../lib/share'
import { useStore } from '../lib/store'
import { plural } from '../lib/text'
import type { SpeedrunStore } from '../modes/speedrun/Speedrun'
import s from './Stats.module.css'

const NO_RUNS: SpeedrunStore = {}

export function Stats() {
  const stats = useStats()
  const capture = useCapture()
  const unlocked = useUnlocked()
  const sr = useStore((st) => (st.speedrun as SpeedrunStore | undefined) ?? NO_RUNS)

  const streak = dayStreak(stats.days)
  const regs = Object.values(stats.regions)
  const seen = regs.reduce((a, r) => a + r.seen, 0)
  const found = regs.reduce((a, r) => a + r.found, 0)
  const capSeen = regs.reduce((a, r) => a + r.capSeen, 0)
  const capOk = regs.reduce((a, r) => a + r.capOk, 0)
  const captured = Object.values(capture.cards).filter((c) => c.level >= CAPTURED_LEVEL).length
  const prog = districtProgress(capture)
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

  const hardest = Object.entries(stats.regions)
    .filter(([, r]) => r.seen + r.capSeen >= 2 && difficulty(r) > 0)
    .sort((a, b) => difficulty(b[1]) - difficulty(a[1]))
    .slice(0, 8)

  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length

  return (
    <div className={s.page}>
      <header className={s.head}>
        <button className="icon-btn" aria-label="Назад" onClick={() => navigate('/')}>
          <Icon name="back" size={20} />
        </button>
        <h1>Статистика</h1>
      </header>

      <div className={s.grid}>
        <section className={`glass ${s.tiles}`}>
          <Tile icon="flame" value={String(streak)} label={`${plural(streak, ['день', 'дня', 'дней'])} подряд`} accent />
          <Tile icon="flag" value={`${captured}/89`} label="захвачено" />
          <Tile icon="pointer" value={pct(found, seen)} label={`точность поиска · ${seen}`} />
          <Tile icon="building" value={pct(capOk, capSeen)} label={`столицы · ${capSeen}`} />
          <Tile icon="trophy" value={sr.best != null ? formatTime(sr.best) : '—'} label="рекорд спидрана" />
          <Tile icon="star" value={String(stats.streakBest)} label="лучшая серия ответов" />
        </section>

        <section className={`glass ${s.section}`}>
          <h2 className={s.title}>Прогресс по округам</h2>
          <div className={s.bars}>
            {DISTRICTS.map((d) => {
              const p = prog[d.id]
              return (
                <div key={d.id} className={s.barRow}>
                  <span className={s.barName}>
                    <span className={s.dot} style={{ background: `var(--d-${d.id})` }} />
                    {d.short}
                  </span>
                  <span className={s.bar}>
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.done / p.total) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                    />
                  </span>
                  <span className={s.barNum}>
                    {p.done}/{p.total}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={`glass ${s.section}`}>
          <h2 className={s.title}>Самые сложные для тебя</h2>
          {hardest.length ? (
            <ol className={s.hard}>
              {hardest.map(([id, r]) => {
                const miss = r.seen - r.found + (r.capSeen - r.capOk)
                return (
                  <li key={id}>
                    <span className={s.hardName}>{REGION_BY_ID[id]?.name}</span>
                    <span className={s.hardMeta}>
                      {miss} {plural(miss, ['ошибка', 'ошибки', 'ошибок'])} · {Math.round(difficulty(r) * 100)}%
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className={s.empty}>Пока мало данных. Пройди пару раундов — и здесь появятся регионы, на которых ты чаще ошибаешься.</p>
          )}
          {hardest.length > 0 && (
            <button className="btn btn-ghost" style={{ marginTop: 12, width: '100%' }} onClick={() => navigate('/board')}>
              Потренировать «У доски»
            </button>
          )}
        </section>

        <section className={`glass ${s.section} ${s.wide}`}>
          <h2 className={s.title}>
            Ачивки · {unlockedCount}/{ACHIEVEMENTS.length}
          </h2>
          <div className={s.badges}>
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} className={`${s.badge} ${unlocked[a.id] ? '' : s.locked}`}>
                <Badge a={a} unlocked={!!unlocked[a.id]} size={58} />
                <div>
                  <div className={s.badgeTitle}>{a.title}</div>
                  <div className={s.badgeText}>{a.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <p className={s.foot}>
        Всего регионов в базе: {REGIONS.length}. Дней занятий: {stats.days.length}.
      </p>
    </div>
  )
}

function Tile({ icon, value, label, accent }: { icon: Parameters<typeof Icon>[0]['name']; value: string; label: string; accent?: boolean }) {
  return (
    <div className={`${s.tile} ${accent ? s.accent : ''}`}>
      <Icon name={icon} size={18} />
      <div className={s.tileValue}>{value}</div>
      <div className={s.tileLabel}>{label}</div>
    </div>
  )
}
