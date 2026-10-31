import { useSyncExternalStore } from 'react'

const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 899px)') : null

/** true на узких экранах (раскладка «телефон»). */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb)
      return () => mq?.removeEventListener('change', cb)
    },
    () => mq?.matches ?? false,
  )
}
