import { DISTRICTS, REGIONS, type DistrictId, type Region } from '../data/regions'
import { acceptedCapitals, preferredCapital, type CapitalPrefs } from './capitals'
import { shuffle } from './random'
import { norm } from './text'

/** Соседние округа — откуда брать неверные варианты, если в своём не хватает. */
const NEAR: Record<DistrictId, DistrictId[]> = {
  cfo: ['szfo', 'pfo', 'yufo'],
  szfo: ['cfo', 'pfo', 'ufo'],
  yufo: ['skfo', 'cfo', 'pfo'],
  skfo: ['yufo', 'cfo', 'pfo'],
  pfo: ['cfo', 'ufo', 'yufo'],
  ufo: ['pfo', 'sfo', 'szfo'],
  sfo: ['ufo', 'dfo', 'pfo'],
  dfo: ['sfo', 'ufo', 'pfo'],
}

/**
 * 4 варианта столицы: верная (с учётом настройки) + 3 неверных из того же
 * федерального округа (так сложнее), при нехватке — из соседних округов.
 */
export function capitalOptions(region: Region, prefs: CapitalPrefs, rand: () => number = Math.random): string[] {
  const correct = preferredCapital(region, prefs)!
  const banned = new Set(acceptedCapitals(region).map(norm))
  const pool = (d: DistrictId) =>
    shuffle(
      REGIONS.filter((r) => r.district === d && r.id !== region.id && r.capital),
      rand,
    ).map((r) => preferredCapital(r, prefs)!)
  const out: string[] = []
  for (const d of [region.district, ...NEAR[region.district]]) {
    for (const c of pool(d)) {
      if (out.length >= 3) break
      if (banned.has(norm(c)) || out.includes(c)) continue
      out.push(c)
    }
    if (out.length >= 3) break
  }
  return shuffle([correct, ...out], rand)
}

export function isCapitalCorrect(answer: string, region: Region): boolean {
  const a = norm(answer)
  return acceptedCapitals(region).some((c) => norm(c) === a)
}

/** Все столицы (основные и альтернативные) для автодополнения. */
export const ALL_CAPITALS: string[] = [...new Set(REGIONS.flatMap((r) => acceptedCapitals(r)))].sort((a, b) =>
  a.localeCompare(b, 'ru'),
)

export function suggestCapitals(q: string, limit = 5): string[] {
  const n = norm(q)
  if (!n) return []
  const starts = ALL_CAPITALS.filter((c) => norm(c).startsWith(n))
  const contains = ALL_CAPITALS.filter((c) => !starts.includes(c) && norm(c).includes(n))
  return [...starts, ...contains].slice(0, limit)
}

export function regionsOfScope(scope: DistrictId | 'all'): Region[] {
  return scope === 'all' ? REGIONS : REGIONS.filter((r) => r.district === scope)
}

export const SCOPES: { id: DistrictId | 'all'; label: string }[] = [
  { id: 'all', label: 'Вся Россия' },
  ...DISTRICTS.map((d) => ({ id: d.id, label: d.short })),
]
