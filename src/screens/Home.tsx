import { m as motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { APP_NAME, APP_TAGLINE, TOTAL_REGIONS } from '../config'
import { Icon, type IconName } from '../components/Icon'
import { Logo } from '../components/Logo'
import { ProgressRing } from '../components/ProgressRing'
import { ThemeToggle } from '../components/ThemeToggle'
import { navigate } from '../lib/router'
import s from './Home.module.css'

interface Mode {
  path: string
  title: string
  text: string
  icon: IconName
  tone: 'lime' | 'violet' | 'sky' | 'amber' | 'coral'
  badge?: string
}

const MODES: Mode[] = [
  { path: '/board', title: 'У доски', text: 'Как на зачёте: регион, таймер, сразу столица', icon: 'pointer', tone: 'lime', badge: 'Главный' },
  { path: '/capture', title: 'Захват карты', text: 'Учи с повторением и закрашивай Россию', icon: 'flag', tone: 'violet' },
  { path: '/speedrun', title: 'Спидран 89', text: 'Все регионы на время и вызов другу', icon: 'bolt', tone: 'amber' },
  { path: '/reference', title: 'Справочник', text: 'Регионы, столицы, поиск', icon: 'book', tone: 'sky' },
  { path: '/neighbors', title: 'Соседи', text: 'Покажи всех соседей региона', icon: 'neighbors', tone: 'coral' },
]

export function Home({ mapSlot, captured = 0 }: { mapSlot?: ReactNode; captured?: number }) {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.brand}>
          <Logo size={34} />
          <span className={s.brandName}>{APP_NAME}</span>
        </div>
        <nav className={s.headerActions} aria-label="Меню">
          <ThemeToggle />
          <button className="icon-btn" aria-label="Статистика" onClick={() => navigate('/stats')}>
            <Icon name="chart" size={20} />
          </button>
          <button className="icon-btn" aria-label="Настройки" onClick={() => navigate('/settings')}>
            <Icon name="gear" size={20} />
          </button>
        </nav>
      </header>

      <section className={s.mapArea} aria-label="Карта России">
        {mapSlot ?? <div className={s.mapPlaceholder} />}
      </section>

      <aside className={s.panel}>
        <div className={`glass ${s.hero}`}>
          <ProgressRing value={captured} max={TOTAL_REGIONS} size={86} />
          <div className={s.heroText}>
            <p className={s.kicker}>Захвачено</p>
            <h1 className={s.heroTitle}>
              {captured}
              <span className={s.heroOf}>/{TOTAL_REGIONS}</span>
            </h1>
            <p className={s.tagline}>{APP_TAGLINE}</p>
          </div>
        </div>

        <div className={s.modes}>
          {MODES.map((m, i) => (
            <ModeCard key={m.path} mode={m} index={i} />
          ))}
        </div>
      </aside>
    </div>
  )
}

function ModeCard({ mode, index }: { mode: Mode; index: number }) {
  return (
    <motion.button
      className={`glass ${s.card} ${s[mode.tone]} ${index === 0 ? s.featured : ''}`}
      onClick={() => navigate(mode.path)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06, type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
    >
      <span className={s.cardIcon}>
        <Icon name={mode.icon} size={22} />
      </span>
      <span className={s.cardBody}>
        <span className={s.cardTitle}>
          {mode.title}
          {mode.badge && <span className={s.badge}>{mode.badge}</span>}
        </span>
        <span className={s.cardText}>{mode.text}</span>
      </span>
      {index === 0 && (
        <span className={s.cardGo} aria-hidden="true">
          <Icon name="play" size={18} />
        </span>
      )}
    </motion.button>
  )
}
