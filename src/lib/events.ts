/** Простая шина событий: режимы сообщают о результатах, ачивки и статистика слушают. */
export interface AnswerEvent {
  mode: 'board' | 'capture' | 'speedrun' | 'neighbors'
  kind: 'find' | 'capital' | 'identify'
  regionId: string
  ok: boolean
  ms?: number
  mapStyle: 'study' | 'board'
}

export interface RoundEvent {
  mode: 'board' | 'capture' | 'speedrun' | 'neighbors'
  ids: string[]
  regionOk: number
  regionN: number
  capOk: number
  capN: number
  /** id регионов без единой ошибки (и место, и столица) */
  perfectIds: string[]
  avgMs: number | null
  totalMs?: number
  mapStyle: 'study' | 'board'
}

type Events = { answer: AnswerEvent; round: RoundEvent }
type Handler<T> = (e: T) => void

const handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {}

export function on<K extends keyof Events>(type: K, h: Handler<Events[K]>) {
  ;(handlers[type] ??= new Set() as never).add(h as never)
  return () => handlers[type]?.delete(h as never)
}

export function emit<K extends keyof Events>(type: K, e: Events[K]) {
  handlers[type]?.forEach((h) => (h as Handler<Events[K]>)(e))
}
