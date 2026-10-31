/** Нормализация для поиска: регистр, ё→е, дефисы и лишние пробелы. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"().,]/g, '')
    .replace(/[-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Склонение: plural(5, ['регион', 'региона', 'регионов']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
