import { createElement } from 'react'
import { DISTRICTS, REGIONS, type DistrictId } from '../data/regions'
import { Icon, type IconName } from '../components/Icon'
import { toast } from '../components/Toasts'
import { burstConfetti } from '../components/Confetti'
import { on } from './events'
import { getCapture, CAPTURED_LEVEL } from './leitner'
import { dayStreak, getStats } from './progress'
import { getState, setState, useStore } from './store'

export interface Achievement {
  id: string
  title: string
  text: string
  icon: IconName
  tone: 'lime' | 'violet' | 'amber' | 'coral' | 'sky'
}

const DISTRICT_ICONS: Record<DistrictId, IconName> = {
  cfo: 'building',
  szfo: 'anchor',
  yufo: 'wave',
  skfo: 'mountain',
  pfo: 'ship',
  ufo: 'mountain',
  sfo: 'compass',
  dfo: 'sunrise',
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', title: 'Первый шаг', text: 'Захвати первый регион', icon: 'flag', tone: 'lime' },
  ...DISTRICTS.map<Achievement>((d) => ({
    id: `district-${d.id}`,
    title: d.achievement,
    text: `Захвати весь ${d.short}`,
    icon: DISTRICT_ICONS[d.id],
    tone: 'violet',
  })),
  { id: 'all', title: 'Вся Россия', text: 'Захвати все 89 регионов', icon: 'crown', tone: 'amber' },
  { id: 'sniper', title: 'Снайпер', text: '20 верных ответов подряд', icon: 'pointer', tone: 'lime' },
  { id: 'lightning', title: 'Молния', text: 'Найди регион быстрее 1,5 с', icon: 'bolt', tone: 'amber' },
  { id: 'caucasus', title: 'Кавказский пленник', text: 'Все 7 регионов СКФО без ошибок за раунд', icon: 'mountain', tone: 'coral' },
  { id: 'capitals', title: 'Столичный житель', text: 'Все столицы без ошибок за один раунд «У доски»', icon: 'building', tone: 'sky' },
  { id: 'speedrunner', title: 'Спидранер', text: 'Спидран быстрее 4 минут', icon: 'timer', tone: 'amber' },
  { id: 'legend', title: 'Легенда', text: 'Спидран быстрее 2:30', icon: 'star', tone: 'amber' },
  { id: 'streak5', title: 'Упорство', text: '5 дней занятий подряд', icon: 'flame', tone: 'coral' },
  { id: 'board-ready', title: 'Готов к доске', text: '89 регионов «Как на доске» с точностью от 90%', icon: 'medal', tone: 'lime' },
]

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))

type Unlocked = Record<string, number>
const NONE: Unlocked = {}

export function useUnlocked(): Unlocked {
  return useStore((s) => (s.achievements as Unlocked | undefined) ?? NONE)
}

function unlock(id: string) {
  const cur = (getState().achievements as Unlocked | undefined) ?? NONE
  if (cur[id]) return
  setState({ achievements: { ...cur, [id]: Date.now() } })
  const a = ACHIEVEMENT_BY_ID[id]
  if (!a) return
  // небольшая задержка, чтобы не перебивать анимацию ответа
  setTimeout(() => {
    toast({
      title: `Ачивка: ${a.title}`,
      text: a.text,
      icon: createElement(Icon, { name: a.icon, size: 20 }),
      tone: a.tone === 'sky' ? 'violet' : a.tone,
      ttl: 4200,
    })
    burstConfetti()
  }, 500)
}

function checkCapture() {
  const cs = getCapture()
  const captured = new Set(Object.entries(cs.cards).filter(([, c]) => c.level >= CAPTURED_LEVEL).map(([id]) => id))
  if (captured.size >= 1) unlock('first')
  if (captured.size >= REGIONS.length) unlock('all')
  for (const d of DISTRICTS) {
    if (REGIONS.filter((r) => r.district === d.id).every((r) => captured.has(r.id))) unlock(`district-${d.id}`)
  }
}

const SKFO = REGIONS.filter((r) => r.district === 'skfo').map((r) => r.id)
const WITH_CAPITAL = REGIONS.filter((r) => r.capital).length

let wired = false
/** Подписать ачивки на события (после wireProgress, чтобы статистика уже была обновлена). */
export function wireAchievements() {
  if (wired) return
  wired = true
  on('answer', (e) => {
    if (e.kind === 'find' && e.ok && e.ms != null && e.ms < 1500) unlock('lightning')
    if (getStats().streakNow >= 20) unlock('sniper')
  })
  on('capture', checkCapture)
  on('round', (e) => {
    if (SKFO.every((id) => e.perfectIds.includes(id))) unlock('caucasus')
    if (e.mode === 'board' && e.capN >= WITH_CAPITAL && e.capOk === e.capN) unlock('capitals')
    if (e.mode === 'speedrun' && e.totalMs != null) {
      if (e.totalMs < 4 * 60_000) unlock('speedrunner')
      if (e.totalMs < 150_000) unlock('legend')
    }
    if (e.mode === 'board' && e.mapStyle === 'board' && e.regionN >= REGIONS.length && e.regionOk / e.regionN >= 0.9) unlock('board-ready')
    if (dayStreak(getStats().days) >= 5) unlock('streak5')
  })
  // на случай импорта прогресса — пересчитать захваты
  setTimeout(checkCapture, 0)
}
