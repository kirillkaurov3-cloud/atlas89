import { AnimatePresence, m as motion } from 'framer-motion'
import { useSyncExternalStore, type ReactNode } from 'react'
import s from './Toasts.module.css'

export interface Toast {
  id: number
  title: string
  text?: string
  icon?: ReactNode
  tone?: 'lime' | 'violet' | 'amber' | 'coral'
  ttl?: number
}

let list: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Показать всплывающее уведомление (ачивка, захват региона и т. п.). */
export function toast(t: Omit<Toast, 'id'>) {
  const id = ++seq
  list = [...list, { ...t, id }].slice(-3)
  notify()
  setTimeout(() => {
    list = list.filter((x) => x.id !== id)
    notify()
  }, t.ttl ?? 3200)
}

export function Toasts() {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => list,
  )
  return (
    <div className={s.root} aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className={`glass ${s.toast} ${s[t.tone ?? 'lime']}`}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {t.icon && <span className={s.icon}>{t.icon}</span>}
            <span className={s.body}>
              <span className={s.title}>{t.title}</span>
              {t.text && <span className={s.text}>{t.text}</span>}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
