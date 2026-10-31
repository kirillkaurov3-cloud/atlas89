/**
 * Безопасная обёртка над localStorage с версией схемы.
 * Любые ошибки (приватный режим Safari, переполнение, битый JSON) глотаются,
 * приложение продолжает работать с данными в памяти.
 */
export const STORAGE_KEY = 'atlas89:state'
export const SCHEMA_VERSION = 1

type Migration = (old: Record<string, unknown>) => Record<string, unknown>

/** Миграции: ключ = версия, С которой мигрируем. Добавлять сюда при изменении схемы. */
const MIGRATIONS: Record<number, Migration> = {
  // 1: (s) => ({ ...s, newField: 'default' }),
}

export function readRaw(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return migrate(parsed)
  } catch {
    return null
  }
}

export function migrate(data: Record<string, unknown>): Record<string, unknown> {
  let v = typeof data.version === 'number' ? data.version : 1
  let cur = data
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v]
    if (m) cur = m(cur)
    v++
  }
  return { ...cur, version: SCHEMA_VERSION }
}

export function writeRaw(data: unknown): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function clearRaw() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ничего */
  }
}
