/**
 * Таблица лидеров.
 *
 * По умолчанию — NoopLeaderboard (всё выключено, UI скрыт, в консоли тихо).
 * Включается сама, если при сборке заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.
 * Тогда @supabase/supabase-js грузится динамическим import — в основной бандл не попадает.
 */

export type LbMode = 'speedrun' | 'board'
export type LbPeriod = 'week' | 'all'

export interface ScoreInput {
  nickname: string
  mode: LbMode
  time_ms: number
  /** точность, % (0–100) */
  accuracy: number
}

export interface ScoreRow extends ScoreInput {
  id: number
  created_at: string
}

export interface LeaderboardService {
  readonly enabled: boolean
  submit(score: ScoreInput): Promise<ScoreRow | null>
  top(mode: LbMode, period: LbPeriod, limit?: number): Promise<ScoreRow[]>
}

export class NoopLeaderboard implements LeaderboardService {
  readonly enabled = false
  async submit() {
    return null
  }
  async top() {
    return []
  }
}

export class SupabaseLeaderboard implements LeaderboardService {
  readonly enabled = true
  private clientPromise: Promise<import('@supabase/supabase-js').SupabaseClient> | null = null
  private url: string
  private key: string

  constructor(url: string, key: string) {
    this.url = url
    this.key = key
  }

  /** Клиент создаётся при первом обращении — библиотека не грузится, пока таблица не нужна. */
  private get client() {
    this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false } }),
    )
    return this.clientPromise
  }

  async submit(score: ScoreInput): Promise<ScoreRow | null> {
    const sb = await this.client
    const { data, error } = await sb
      .from('scores')
      .insert({
        nickname: score.nickname.trim().slice(0, 20),
        mode: score.mode,
        time_ms: Math.round(score.time_ms),
        accuracy: Math.max(0, Math.min(100, Math.round(score.accuracy * 10) / 10)),
      })
      .select()
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
      .single()
    if (error) throw new Error(friendly(error.message))
    return data as ScoreRow
  }

  async top(mode: LbMode, period: LbPeriod, limit = 50): Promise<ScoreRow[]> {
    const sb = await this.client
    let q = sb
      .from('scores')
      .select('*')
      .eq('mode', mode)
      .order('time_ms', { ascending: true })
      .limit(limit * 4)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
    if (period === 'week') q = q.gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString())
    const { data, error } = await q
    if (error) throw new Error(friendly(error.message))
    // лучший результат каждого ника
    const seen = new Set<string>()
    const out: ScoreRow[] = []
    for (const r of (data ?? []) as ScoreRow[]) {
      const k = r.nickname.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(r)
      if (out.length >= limit) break
    }
    return out
  }
}

/** Спящий проект Supabase может не отвечать — не ждём бесконечно. */
const TIMEOUT_MS = 10000

function friendly(msg: string): string {
  if (/abort|timeout/i.test(msg)) return 'Сервер не отвечает'
  const m = msg.match(/too_many_requests:\s*(.+)/)
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1)
  if (/check constraint/i.test(msg)) return 'Результат не прошёл проверку'
  if (/fetch|network/i.test(msg)) return 'Нет связи с сервером'
  return msg
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const leaderboard: LeaderboardService = url && key ? new SupabaseLeaderboard(url, key) : new NoopLeaderboard()

// ---------- «свои» записи — для подсветки позиции ----------
const MINE_KEY = 'atlas89:lb-mine'

export function rememberMine(id: number) {
  try {
    const cur = JSON.parse(localStorage.getItem(MINE_KEY) || '[]') as number[]
    localStorage.setItem(MINE_KEY, JSON.stringify([...cur, id].slice(-200)))
  } catch {
    /* ничего */
  }
}

export function mineIds(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MINE_KEY) || '[]') as number[])
  } catch {
    return new Set()
  }
}
