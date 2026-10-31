import { useEffect } from 'react'
import { useStore } from './store'

/** Применяет тему к <html data-theme> с учётом prefers-color-scheme. */
export function useThemeEffect() {
  const pref = useStore((s) => s.settings.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const t = pref === 'system' ? (mq.matches ? 'light' : 'dark') : pref
      document.documentElement.dataset.theme = t
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#EEF0F8' : '#070A16')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])
}

export function currentTheme(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}
