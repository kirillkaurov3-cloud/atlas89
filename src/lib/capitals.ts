import type { Region } from '../data/regions'

export type CapitalPrefs = Record<string, 'main' | 'alt'>

/** Столица, которую показываем как правильную (с учётом настройки для спорных субъектов). */
export function preferredCapital(r: Region, prefs: CapitalPrefs): string | null {
  if (!r.capital) return null
  return prefs[r.id] === 'alt' && r.capitalAlt ? r.capitalAlt : r.capital
}

export const capitalLabel = (r: Region, prefs: CapitalPrefs) => preferredCapital(r, prefs) ?? ''

/** Все варианты, которые засчитываются как верные. */
export function acceptedCapitals(r: Region): string[] {
  return [r.capital, r.capitalAlt].filter((c): c is string => !!c)
}
