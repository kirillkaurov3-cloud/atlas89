/**
 * Проверка данных карты. Падает с ошибкой (exit 1), если что-то не так:
 *   • в справочнике ровно 89 субъектов, по округам 18+11+12+7+14+6+10+11;
 *   • id и названия уникальны;
 *   • в геометрии ровно 89 объектов, каждый сопоставлен со справочником;
 *   • нет пустых геометрий, bbox и площадь корректны, соседство симметрично.
 * Запуск: npm run validate
 */
import { readFileSync } from 'node:fs'
import { REGIONS, EXPECTED_COUNTS, DISTRICTS } from '../src/data/regions.ts'

const errors = []
const fail = (m) => errors.push(m)

// --- справочник ---
if (REGIONS.length !== 89) fail(`В справочнике ${REGIONS.length} субъектов, а должно быть 89`)
const expectedTotal = Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0)
if (expectedTotal !== 89) fail(`Сумма по округам ${expectedTotal} ≠ 89`)
for (const d of DISTRICTS) {
  const n = REGIONS.filter((r) => r.district === d.id).length
  if (n !== EXPECTED_COUNTS[d.id]) fail(`${d.short}: ${n} субъектов, ожидалось ${EXPECTED_COUNTS[d.id]}`)
}
const dupe = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i)
for (const id of dupe(REGIONS.map((r) => r.id))) fail(`Дубль id в справочнике: ${id}`)
for (const n of dupe(REGIONS.map((r) => r.name))) fail(`Дубль названия: ${n}`)
for (const r of REGIONS) {
  if (r.type === 'город федерального значения') {
    if (r.capital !== null) fail(`${r.name}: у города федерального значения не должно быть столицы`)
  } else if (!r.capital) fail(`${r.name}: не указана столица`)
}

// --- геометрия ---
const geo = JSON.parse(readFileSync(new URL('../src/data/regions.svg.json', import.meta.url), 'utf8'))
const ids = Object.keys(geo.regions)
if (ids.length !== 89) fail(`В геометрии ${ids.length} объектов, а должно быть 89`)
const known = new Set(REGIONS.map((r) => r.id))
for (const id of ids) if (!known.has(id)) fail(`Геометрия «${id}» не найдена в справочнике`)
for (const r of REGIONS) if (!geo.regions[r.id]) fail(`Нет геометрии для «${r.name}» (${r.id})`)
for (const [id, g] of Object.entries(geo.regions)) {
  if (!g.d || !/^M-?\d/.test(g.d) || g.d.length < 20) fail(`${id}: пустая или битая геометрия`)
  const [x0, y0, x1, y1] = g.b ?? []
  if (!(x1 > x0 && y1 > y0)) fail(`${id}: некорректный bbox`)
  if (!(g.a > 0)) fail(`${id}: нулевая площадь`)
  if (!Array.isArray(g.c) || g.c.length !== 2) fail(`${id}: нет центральной точки`)
  for (const n of g.n ?? []) {
    if (!geo.regions[n]) fail(`${id}: неизвестный сосед ${n}`)
    else if (!geo.regions[n].n.includes(id)) fail(`${id} → ${n}: соседство не симметрично`)
  }
}
const dupD = dupe(Object.values(geo.regions).map((g) => g.d))
if (dupD.length) fail(`Есть одинаковые геометрии у разных регионов (${dupD.length})`)

if (errors.length) {
  console.error('✗ Проверка карты не пройдена:\n  • ' + errors.join('\n  • '))
  process.exit(1)
}
const kb = (readFileSync(new URL('../src/data/regions.svg.json', import.meta.url)).length / 1024).toFixed(0)
console.log(`✓ Карта в порядке: 89 субъектов, все сопоставлены со справочником (${kb} КБ)`)
