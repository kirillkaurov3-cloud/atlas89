import { useSyncExternalStore } from 'react'

/**
 * Минимальный hash-роутер: адреса вида #/board, #/challenge?seed=1&t=192.
 * Работает на GitHub Pages без настроек сервера.
 */
export interface Route {
  path: string
  query: URLSearchParams
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs = ''] = hash.split('?')
  return { path: path || '/', query: new URLSearchParams(qs) }
}

let current = parse()
let currentKey = window.location.hash
const listeners = new Set<() => void>()

window.addEventListener('hashchange', () => {
  current = parse()
  currentKey = window.location.hash
  listeners.forEach((l) => l())
})

export function useRoute(): Route {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => currentKey,
  )
  return current
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = '#' + (to.startsWith('/') ? to : '/' + to)
  if (opts.replace) {
    history.replaceState(null, '', hash)
    current = parse()
    currentKey = hash
    listeners.forEach((l) => l())
  } else {
    window.location.hash = hash
  }
}

/** Полная ссылка на маршрут внутри приложения (для «Бросить вызов»). */
export function absoluteUrl(to: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#${to}`
}
