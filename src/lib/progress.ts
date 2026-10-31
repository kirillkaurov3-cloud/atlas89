import { on, type AnswerEvent, type RoundEvent } from './events'
import { getState, setState, useStore, type AppState } from './store'

/** Статистика по региону (копится во всех режимах). */
export interface RegionStat {
  /** сколько раз искали на карте */
  seen: number
  /** сколько раз нашли верно */
  found: number
  /** столица: спрошено / верно */
  capSeen: number
  capOk: number
  /** суммарное время успешного поиска, мс, и количество */
  findMs: number
  findN: number
  bestMs?: number
  last: number
}

export interface SessionRecord {
  mode: RoundEvent['mode']
  at: number
  n: number
  regionOk: number
  capN: number
  capOk: number
  avgMs: number | null
  totalMs?: number
  style: 'study' | 'board'
}

export interface Stats {
  regions: Record<string, RegionStat>
  /** даты занятий YYYY-MM-DD (по местному времени) */
  days: string[]
  sessions: SessionRecord[]
  /** текущая серия верных ответов подряд (поиск) */
  streakNow: number
  streakBest: number
}

export const EMPTY_STATS: Stats = { regions: {}, days: [], sessions: [], streakNow: 0, streakBest: 0 }

export function getStats(s: AppState = getState()): Stats {
  return { ...EMPTY_STATS, ...((s.stats as Stats | undefined) ?? {}) }
}

export function useStats(): Stats {
  return useStore((s) => (s.stats as Stats | undefined) ?? EMPTY_STATS)
}

export function today(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Серия дней подряд, заканчивающаяся сегодня или вчера. */
export function dayStreak(days: string[]): number {
  if (!days.length) return 0
  const set = new Set(days)
  const d = new Date()
  if (!set.has(today(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (set.has(today(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

function updateStats(fn: (st: Stats) => Stats) {
  setState((s) => ({ stats: fn(getStats(s)) }))
}

function touchDay(st: Stats): string[] {
  const t = today()
  if (st.days[st.days.length - 1] === t) return st.days
  return [...st.days.filter((d) => d !== t), t].slice(-120)
}

export function recordAnswer(e: AnswerEvent) {
  updateStats((st) => {
    const prev: RegionStat = st.regions[e.regionId] ?? { seen: 0, found: 0, capSeen: 0, capOk: 0, findMs: 0, findN: 0, last: 0 }
    const r = { ...prev, last: Date.now() }
    let { streakNow, streakBest } = st
    if (e.kind === 'find' || e.kind === 'identify') {
      r.seen++
      if (e.ok) {
        r.found++
        if (e.ms != null && e.kind === 'find') {
          r.findMs += e.ms
          r.findN++
          r.bestMs = Math.min(r.bestMs ?? Infinity, e.ms)
        }
        streakNow++
        streakBest = Math.max(streakBest, streakNow)
      } else streakNow = 0
    } else {
      r.capSeen++
      if (e.ok) r.capOk++
    }
    return { ...st, regions: { ...st.regions, [e.regionId]: r }, days: touchDay(st), streakNow, streakBest }
  })
}

export function recordRound(e: RoundEvent) {
  updateStats((st) => ({
    ...st,
    days: touchDay(st),
    sessions: [
      ...st.sessions,
      {
        mode: e.mode,
        at: Date.now(),
        n: e.regionN,
        regionOk: e.regionOk,
        capN: e.capN,
        capOk: e.capOk,
        avgMs: e.avgMs,
        totalMs: e.totalMs,
        style: e.mapStyle,
      },
    ].slice(-60),
  }))
}

/** Доля ошибок по региону (для «самых сложных» и частоты повторения). */
export function difficulty(r: RegionStat | undefined): number {
  if (!r) return 0
  const miss = r.seen - r.found + (r.capSeen - r.capOk)
  const total = r.seen + r.capSeen
  return total ? miss / total : 0
}

let wired = false
/** Подключить запись статистики к шине событий (один раз при старте). */
export function wireProgress() {
  if (wired) return
  wired = true
  on('answer', recordAnswer)
  on('round', recordRound)
}
