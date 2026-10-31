import { useSyncExternalStore } from 'react'
import { readRaw, writeRaw, SCHEMA_VERSION } from './storage'

export type ThemePref = 'system' | 'dark' | 'light'
export type MapStyle = 'study' | 'board'

export interface Settings {
  theme: ThemePref
  mapStyle: MapStyle
  /** Таймер поиска региона в режиме «У доски», 0 = без таймера */
  timerSec: 0 | 5 | 7 | 10
  /** Как отвечать на «Назови столицу» */
  capitalInput: 'choice' | 'typing'
  /** Какую столицу считать основной для спорных субъектов (id региона → вариант) */
  capitalPrefs: Record<string, 'main' | 'alt'>
  insetsCollapsed: boolean
}

export interface Profile {
  nickname: string | null
  nickAsked: boolean
}

export interface AppState {
  version: number
  settings: Settings
  profile: Profile
  /** Остальные разделы (прогресс, статистика, ачивки) добавляются по этапам */
  [key: string]: unknown
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  mapStyle: 'study',
  timerSec: 7,
  capitalInput: 'choice',
  capitalPrefs: {},
  insetsCollapsed: false,
}

function initial(): AppState {
  const raw = readRaw() ?? {}
  return {
    ...raw,
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...((raw.settings as object) ?? {}) },
    profile: { nickname: null, nickAsked: false, ...((raw.profile as object) ?? {}) },
  }
}

let state: AppState = initial()
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    writeRaw(state)
  }, 150)
}

if (typeof window !== 'undefined') {
  // Не теряем последние изменения при закрытии вкладки
  window.addEventListener('pagehide', () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
      writeRaw(state)
    }
  })
}

export function getState(): AppState {
  return state
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof update === 'function' ? update(state) : update
  state = { ...state, ...patch }
  scheduleSave()
  listeners.forEach((l) => l())
}

export function replaceState(next: AppState) {
  state = next
  writeRaw(state)
  listeners.forEach((l) => l())
}

export function resetState() {
  state = {
    version: SCHEMA_VERSION,
    settings: { ...state.settings },
    profile: { ...state.profile },
  }
  writeRaw(state)
  listeners.forEach((l) => l())
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  )
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch } }))
}

export function updateProfile(patch: Partial<Profile>) {
  setState((s) => ({ profile: { ...s.profile, ...patch } }))
}
