import { AnimatePresence, motion } from 'framer-motion'
import { updateSettings, useStore } from '../lib/store'
import { Icon } from './Icon'

/** Быстрый переключатель тёмной/светлой темы. */
export function ThemeToggle() {
  const pref = useStore((s) => s.settings.theme)
  const isLight =
    pref === 'light' || (pref === 'system' && typeof window !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches)
  return (
    <button
      className="icon-btn"
      aria-label={isLight ? 'Тёмная тема' : 'Светлая тема'}
      onClick={() => updateSettings({ theme: isLight ? 'dark' : 'light' })}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isLight ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25 }}
          style={{ display: 'grid' }}
        >
          <Icon name={isLight ? 'moon' : 'sun'} size={20} />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
