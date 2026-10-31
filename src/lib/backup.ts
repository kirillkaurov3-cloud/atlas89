import { migrate, SCHEMA_VERSION } from './storage'
import { DEFAULT_SETTINGS, getState, replaceState, type AppState } from './store'
import { today } from './progress'

const MARK = 'atlas89-progress'

/** Скачать прогресс одним JSON-файлом. */
export function exportProgress() {
  const payload = { app: MARK, exportedAt: new Date().toISOString(), schema: SCHEMA_VERSION, data: getState() }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `atlas89-progress-${today()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Импорт: проверяем формат, прогоняем миграции схемы. Бросает Error с понятным текстом. */
export async function importProgress(file: File): Promise<void> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Файл слишком большой')
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('Это не JSON-файл прогресса')
  }
  const p = parsed as { app?: string; data?: Record<string, unknown> }
  if (!p || p.app !== MARK || !p.data || typeof p.data !== 'object') throw new Error('Файл не похож на прогресс «Атлас 89»')
  const data = migrate(p.data)
  const next: AppState = {
    ...data,
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...((data.settings as object) ?? {}) },
    profile: { nickname: null, nickAsked: true, ...((data.profile as object) ?? {}) },
  }
  replaceState(next)
}
