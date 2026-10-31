/**
 * «Захват карты»: интервальное повторение по системе Лейтнера.
 *
 * Карточка = регион. Попытка = «место» (найти на карте или узнать подсвеченный)
 * + «столица» (у городов федерального значения только место). Попытка засчитана,
 * если верно и то и другое.
 *
 * Уровни и когда спросить снова:
 *   0 → 1  через 3 вопроса (в этой же сессии)
 *   1 → 2  в следующей сессии
 *   2 → 3  через день
 *   3 → 4  через 3 дня
 *   4      — регион ЗАХВАЧЕН; контрольное повторение через 7 дней
 * Ошибка: уровень сбрасывается в 0 (захваченный — откатывается на 2),
 * регион вернётся через 2 вопроса — ошибочные приходят чаще.
 *
 * Быстрый режим (переключатель): без ожидания между сессиями и днями —
 * интервалы считаются в вопросах: +3 → +6 → +10 → +15, и всю карту
 * можно захватить за один вечер.
 */
import { REGIONS, type DistrictId } from '../data/regions'
import { emit } from './events'
import { getState, setState, useStore, type AppState } from './store'

export const CAPTURED_LEVEL = 4
const DAY = 24 * 60 * 60 * 1000
/** Быстрый режим: через сколько вопросов спросить снова на уровнях 0→1, 1→2, 2→3, 3→4 */
const FAST_GAPS = [3, 6, 10, 15]

export interface Card {
  level: number
  /** не раньше этого времени (мс) */
  dueAt: number
  /** не раньше этой сессии */
  dueSession: number
  /** в текущей сессии — не раньше этого номера вопроса */
  dueQ: number
  /** сессия, в которой выставлен dueQ */
  qSession: number
  lapses: number
  /** сколько раз было верно */
  wins: number
  capturedAt?: number
}

export interface CaptureState {
  cards: Record<string, Card>
  session: number
}

const EMPTY: CaptureState = { cards: {}, session: 0 }

export function getCapture(s: AppState = getState()): CaptureState {
  return { ...EMPTY, ...((s.capture as CaptureState | undefined) ?? {}) }
}

export function useCapture(): CaptureState {
  return useStore((s) => (s.capture as CaptureState | undefined) ?? EMPTY)
}

export function isCaptured(c: Card | undefined): boolean {
  return !!c && c.level >= CAPTURED_LEVEL
}

export function capturedIds(cs: CaptureState): string[] {
  return Object.entries(cs.cards)
    .filter(([, c]) => isCaptured(c))
    .map(([id]) => id)
}

export function useCapturedCount(): number {
  return useStore((s) => {
    const cs = (s.capture as CaptureState | undefined) ?? EMPTY
    let n = 0
    for (const c of Object.values(cs.cards)) if (c.level >= CAPTURED_LEVEL) n++
    return n
  })
}

/** Начать новую сессию (номер нужен для интервала «в следующей сессии»). */
export function startSession(): number {
  const cs = getCapture()
  const session = cs.session + 1
  setState({ capture: { ...cs, session } })
  return session
}

function newCard(): Card {
  return { level: 0, dueAt: 0, dueSession: 0, dueQ: 0, qSession: 0, lapses: 0, wins: 0 }
}

/** Применить результат попытки. Возвращает обновлённую карточку и «был ли только что захвачен». */
export function applyResult(
  id: string,
  ok: boolean,
  session: number,
  qn: number,
  fast = false,
  now = Date.now(),
): { card: Card; justCaptured: boolean; lost: boolean } {
  const cs = getCapture()
  const prev = cs.cards[id] ?? newCard()
  const c: Card = { ...prev }
  let justCaptured = false
  let lost = false
  if (ok) {
    c.wins++
    const from = c.level
    c.level = Math.min(CAPTURED_LEVEL, c.level + 1)
    c.qSession = session
    c.dueQ = 0
    c.dueSession = 0
    c.dueAt = 0
    if (fast && from < CAPTURED_LEVEL) {
      if (from + 1 < CAPTURED_LEVEL) c.dueQ = qn + FAST_GAPS[from]
      else c.dueAt = now + 7 * DAY
    } else if (from === 0) {
      c.dueQ = qn + 3
    } else if (from === 1) {
      c.dueSession = session + 1
    } else if (from === 2) {
      c.dueAt = now + DAY
    } else if (from === 3) {
      c.dueAt = now + 3 * DAY
    } else {
      c.dueAt = now + 7 * DAY
    }
    if (from < CAPTURED_LEVEL && c.level >= CAPTURED_LEVEL) {
      justCaptured = true
      c.capturedAt = now
    }
  } else {
    lost = c.level >= CAPTURED_LEVEL
    c.lapses++
    c.level = lost ? 2 : 0
    c.dueAt = 0
    c.dueSession = 0
    c.qSession = session
    c.dueQ = qn + 2
  }
  setState({ capture: { ...cs, cards: { ...cs.cards, [id]: c } } })
  emit('capture', { regionId: id, captured: c.level >= CAPTURED_LEVEL })
  return { card: c, justCaptured, lost }
}

export function isDue(c: Card, session: number, qn: number, fast = false, now = Date.now()): boolean {
  if (c.qSession === session && c.dueQ > 0) return qn >= c.dueQ
  // быстрый режим: незахваченные не ждут следующей сессии и следующего дня
  if (fast && c.level < CAPTURED_LEVEL) return true
  if (c.dueSession && session < c.dueSession) return false
  if (c.dueAt && now < c.dueAt) return false
  // карточка уровня 0 из прошлой сессии — сразу
  return true
}

/**
 * Следующий регион для вопроса:
 *  1) просроченные/подошедшие карточки (сначала с ошибками, затем по уровню);
 *  2) новые регионы — без ограничений, можно учить сразу все;
 *  3) иначе — ближайшая по очереди в сессии (чтобы не стоять на месте).
 */
export function pickNext(opts: {
  pool: string[]
  session: number
  qn: number
  lastId?: string
  fast?: boolean
  rand?: () => number
}): string | null {
  const { pool, session, qn, lastId, fast = false, rand = Math.random } = opts
  const cs = getCapture()
  const now = Date.now()
  const due: [number, string][] = []
  const fresh: string[] = []
  const waitingInSession: [number, string][] = []
  for (const id of pool) {
    const c = cs.cards[id]
    if (!c) {
      fresh.push(id)
      continue
    }
    if (c.level === 0 && c.wins === 0 && c.lapses === 0) {
      fresh.push(id)
      continue
    }
    if (id === lastId) continue
    if (isDue(c, session, qn, fast, now)) {
      // приоритет: больше ошибок и меньше уровень — раньше
      due.push([c.level * 10 - c.lapses * 3 + rand(), id])
    } else if (c.qSession === session && c.dueQ > 0) waitingInSession.push([c.dueQ, id])
  }
  if (due.length) return due.sort((a, b) => a[0] - b[0])[0][1]
  if (fresh.length) return fresh[Math.floor(rand() * fresh.length)]
  if (waitingInSession.length) return waitingInSession.sort((a, b) => a[0] - b[0])[0][1]
  return null
}

/** Прогресс по округам: захвачено / всего. */
export function districtProgress(cs: CaptureState): Record<DistrictId, { done: number; total: number }> {
  const out = {} as Record<DistrictId, { done: number; total: number }>
  for (const r of REGIONS) {
    const d = (out[r.district] ??= { done: 0, total: 0 })
    d.total++
    if (isCaptured(cs.cards[r.id])) d.done++
  }
  return out
}

/** Сколько карточек ждут повторения прямо сейчас (для бейджа на главной). */
export function dueCount(cs: CaptureState, now = Date.now()): number {
  let n = 0
  for (const c of Object.values(cs.cards)) {
    if (c.level === 0 && !c.wins && !c.lapses) continue
    if (c.dueSession && cs.session + 1 < c.dueSession) continue
    if (c.dueAt && now < c.dueAt) continue
    if (c.dueAt || c.dueSession || c.level === 0) n++
  }
  return n
}
