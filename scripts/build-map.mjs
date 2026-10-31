/**
 * Сборка геометрии карты (запускается один раз, результат коммитится):
 *   node scripts/fetch-sources.mjs   — скачать исходники в scripts/.cache
 *   node scripts/build-map.mjs       — собрать src/data/regions.svg.json и context.svg.json
 *
 * Источники:
 *   • 85 субъектов — github.com/hairymax/offline_russia_plotly (данные OpenStreetMap)
 *   • ДНР, ЛНР, Запорожская, Херсонская обл. — Natural Earth 10m admin-1 (public domain)
 *   • соседние страны, озёра, реки, формы рельефа — Natural Earth (public domain)
 *
 * Проекция: равновеликая коническая (как в школьных атласах),
 * центральный меридиан 100° в.д., стандартные параллели 52° и 64°.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { geoConicEqualArea, geoPath, geoGraticule } from 'd3-geo'
import { feature, neighbors as topoNeighbors } from 'topojson-client'
import polylabel from 'polylabel'
import { REGIONS } from '../src/data/regions.ts'

const CACHE = 'scripts/.cache'
const OUT = 'src/data'
const W = 10000 // ширина координатного пространства карты (целые числа = компактные path)

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'))
const ms = (input, ...args) => execFileSync('npx', ['mapshaper', '-i', input, '-quiet', ...args], { stdio: 'inherit' })

// ---------- 1. Склейка источников ----------
const byName = Object.fromEntries(REGIONS.map((r) => [r.name, r.id]))
const ru = readJSON(`${CACHE}/russia_regions.geojson`)
const features = []
for (const f of ru.features) {
  const id = byName[f.properties.region]
  if (!id) throw new Error(`Нет в справочнике: ${f.properties.region}`)
  features.push({ type: 'Feature', properties: { id }, geometry: f.geometry })
}
const NE_UKR = { "Donets'k": 'dnr', "Luhans'k": 'lnr', Zaporizhzhya: 'zaporozhye', Kherson: 'kherson' }
const ne1 = readJSON(`${CACHE}/ne_10m_admin_1.geojson`)
for (const f of ne1.features) {
  if (f.properties.adm0_a3 !== 'UKR') continue
  const id = NE_UKR[f.properties.name]
  if (id) features.push({ type: 'Feature', properties: { id }, geometry: f.geometry })
}

// Чукотка и острова за 180-м меридианом: сдвигаем западные долготы на +360,
// чтобы регион не рвался и не тянулся через всю карту.
function unwrap(geom) {
  // Сдвигаем только «азиатскую» сторону (−180…−90), Европа к западу от Гринвича не трогается
  const fix = (c) => (typeof c[0] === 'number' ? (c[0] < -90 ? [c[0] + 360, c[1]] : c) : c.map(fix))
  return { ...geom, coordinates: fix(geom.coordinates) }
}
for (const f of features) f.geometry = unwrap(f.geometry)

mkdirSync(CACHE, { recursive: true })
writeFileSync(`${CACHE}/merged.geojson`, JSON.stringify({ type: 'FeatureCollection', features }))
console.log(`Склеено объектов: ${features.length}`)

// ---------- 2. Упрощение с сохранением топологии ----------
// interval — допуск упрощения в градусах (данные выходят за 180°, поэтому mapshaper
// считает их плоскими): 0,015° ≈ 1–1,5 км. Мелкие регионы сохраняют детали,
// крупные упрощаются сильнее в относительном выражении.
const SIMPLIFY = process.env.SIMPLIFY || '0.015'
ms(
  `${CACHE}/merged.geojson`,
  // Важно: без -filter-islands (он удаляет Калининград и Сахалин целиком)
  // и без snap-interval (ломает мелкие полигоны). Мелкие острова отсекаем сами при кодировании.
  '-clean', 'gap-fill-area=0.03', 'sliver-control=1',
  '-simplify', `interval=${SIMPLIFY}`, 'keep-shapes',
  '-clean', 'gap-fill-area=0.03',
  '-o', `${CACHE}/simplified.topojson`, 'format=topojson', 'force',
)
const topo = readJSON(`${CACHE}/simplified.topojson`)
const objName = Object.keys(topo.objects)[0]
const geoms = topo.objects[objName].geometries
const regionsGeo = feature(topo, topo.objects[objName])

// Соседи по общим границам топологии
const nb = topoNeighbors(geoms)
const neighbors = {}
geoms.forEach((g, i) => {
  neighbors[g.properties.id] = [...new Set(nb[i].map((j) => geoms[j].properties.id))].filter((x) => x !== g.properties.id).sort()
})

// ---------- 3. Проекция ----------
const projection = geoConicEqualArea().rotate([-100, 0]).parallels([52, 64]).precision(0.1)
// Вписываем по России с небольшим полем
projection.fitWidth(W, regionsGeo)
const pathGen = geoPath(projection)
const [[bx0, by0], [bx1, by1]] = pathGen.bounds(regionsGeo)
const PAD = 120
projection.translate([projection.translate()[0] - bx0 + PAD, projection.translate()[1] - by0 + PAD])
const VW = Math.ceil(bx1 - bx0 + PAD * 2)
const VH = Math.ceil(by1 - by0 + PAD * 2)

/** Проецирует геометрию и кодирует в компактный path: целые координаты, относительные шаги. */
function encode(geom, minRingArea = 0, clipRect = null, minStep = 0) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
  const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : []
  let d = ''
  const rings = []
  // Самое большое кольцо не отбрасываем никогда, даже если оно меньше порога
  let maxArea = 0
  if (minRingArea > 0)
    for (const poly of polys) for (const ring of poly) {
      const a = Math.abs(ringArea(ring.map((p) => projection(p))))
      if (a > maxArea) maxArea = a
    }
  const enc = (pts, close) => {
    const q = []
    for (const p of pts) {
      const xy = projection(p)
      if (!xy) continue
      const x = Math.round(xy[0])
      const y = Math.round(xy[1])
      const last = q[q.length - 1]
      // minStep — прореживание (для фоновых слоёв): точки ближе minStep к предыдущей пропускаем
      if (!last || (minStep ? Math.abs(last[0] - x) + Math.abs(last[1] - y) >= minStep : last[0] !== x || last[1] !== y)) q.push([x, y])
    }
    if (close && q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]) q.pop()
    if (close && clipRect) {
      const c = clipPolygon(q, clipRect)
      q.length = 0
      q.push(...c)
    }
    if (q.length < (close ? 3 : 2)) return
    if (close && minRingArea > 0 && Math.abs(ringArea(q)) < Math.min(minRingArea, maxArea * 0.999)) return
    let s = `M${q[0][0]} ${q[0][1]}`
    let cmd = ''
    for (let i = 1; i < q.length; i++) {
      const dx = q[i][0] - q[i - 1][0]
      const dy = q[i][1] - q[i - 1][1]
      const part = `${dx}${dy < 0 ? '' : ' '}${dy}`
      s += cmd === 'l' ? (dx < 0 ? part : ' ' + part) : 'l' + part
      cmd = 'l'
    }
    d += s + (close ? 'z' : '')
    rings.push(q)
  }
  for (const poly of polys) poly.forEach((ring) => enc(ring, true))
  for (const line of lines) enc(line, false)
  return { d, rings }
}

/** Отсечение кольца прямоугольником (Сазерленд — Ходжман). */
function clipPolygon(pts, [x0, y0, x1, y1]) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ]
  const cross = [
    (a, b) => [x0, Math.round(a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0]))],
    (a, b) => [x1, Math.round(a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0]))],
    (a, b) => [Math.round(a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1])), y0],
    (a, b) => [Math.round(a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1])), y1],
  ]
  let out = pts
  for (let e = 0; e < 4; e++) {
    const inp = out
    out = []
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i]
      const prev = inp[(i + inp.length - 1) % inp.length]
      const ci = edges[e](cur)
      const pi = edges[e](prev)
      if (ci) {
        if (!pi) out.push(cross[e](prev, cur))
        out.push(cur)
      } else if (pi) out.push(cross[e](prev, cur))
    }
    if (!out.length) break
  }
  // убираем повторы
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1])
}

function ringArea(r) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1])
  return a / 2
}

// ---------- 4. Регионы ----------
const out = {}
let totalPts = 0
for (const f of regionsGeo.features) {
  const id = f.properties.id
  // ~1 ед.² ≈ 0,5 км²: отбрасываем островки меньше ~30 км²
  const { d, rings } = encode(f.geometry, Number(process.env.MIN_RING || 60))
  totalPts += rings.reduce((s, r) => s + r.length, 0)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of rings) for (const [x, y] of r) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  // Точка для подписи/камеры: «полюс недоступности» самого большого кольца
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  let best = null
  let bestArea = -1
  for (const poly of polys) {
    const proj = poly.map((ring) => ring.map((p) => projection(p)))
    const a = Math.abs(ringArea(proj[0]))
    if (a > bestArea) {
      bestArea = a
      best = proj
    }
  }
  const pl = polylabel(best, 1)
  const area = rings.reduce((s, r) => s + Math.abs(ringArea(r)), 0)
  out[id] = {
    d,
    c: [Math.round(pl[0]), Math.round(pl[1])],
    b: [x0, y0, x1, y1],
    a: Math.round(area),
    n: neighbors[id] ?? [],
  }
}

// Порядок как в справочнике
const ordered = {}
for (const r of REGIONS) if (out[r.id]) ordered[r.id] = out[r.id]
for (const id of Object.keys(out)) if (!ordered[id]) ordered[id] = out[id]

writeFileSync(`${OUT}/regions.svg.json`, JSON.stringify({ viewBox: [0, 0, VW, VH], regions: ordered }))
console.log(`Регионов: ${Object.keys(ordered).length}, точек: ${totalPts}, viewBox ${VW}×${VH}`)

// ---------- 5. Контекст: соседние страны, озёра, реки, сетка, врезки ----------
const CLIP = '-30,8,245,89.5' // lon/lat-рамка с большим запасом; точнее режем после проекции
ms(
  `${CACHE}/ne_50m_admin_0_countries.geojson`,
  '-filter', '"RUS" != ADM0_A3',
  '-clip', `bbox=${CLIP}`,
  // вырезаем наши субъекты (Крым и новые регионы в NE числятся за Украиной)
  '-erase', `${CACHE}/merged.geojson`,
  '-simplify', 'interval=0.25', 'keep-shapes',
  '-dissolve',
  '-o', `${CACHE}/ctx_land.geojson`, 'force',
)
ms(
  `${CACHE}/ne_10m_lakes.geojson`,
  '-clip', 'bbox=19,40,190,80',
  '-filter', 'scalerank <= 3',
  '-simplify', 'interval=0.04', 'keep-shapes',
  '-o', `${CACHE}/ctx_lakes.geojson`, 'force',
)
ms(
  `${CACHE}/ne_10m_rivers_lake_centerlines.geojson`,
  '-clip', 'bbox=19,40,190,80',
  '-filter', 'scalerank <= 4 && featurecla == "River"',
  '-simplify', 'interval=0.06',
  '-o', `${CACHE}/ctx_rivers.geojson`, 'force',
)

const unwrapFC = (fc) => {
  const feats = fc.features ?? (fc.geometries ?? [fc]).map((g) => ({ type: 'Feature', geometry: g }))
  return { type: 'FeatureCollection', features: feats.filter((f) => f.geometry).map((f) => ({ ...f, geometry: unwrap(f.geometry) })) }
}
const land = unwrapFC(readJSON(`${CACHE}/ctx_land.geojson`))
const lakes = unwrapFC(readJSON(`${CACHE}/ctx_lakes.geojson`))
const rivers = unwrapFC(readJSON(`${CACHE}/ctx_rivers.geojson`))
// Соседние страны рисуем далеко за краями карты: на высоком экране телефона край не попадает в кадр
// (раньше это прятали маски затухания, но они втрое замедляли отрисовку)
const VIEW = [-VW * 0.5, -VH * 1.2, VW * 1.5, VH * 2.2]
const join = (fc, minArea = 0, clip = null, step = 0) => fc.features.map((f) => encode(f.geometry, minArea, clip, step).d).join('')

const grat = geoGraticule().extent([[-30, 0], [240, 85]]).step([10, 10])()
const gratD = encode(grat).d

// Врезки: рамки в градусах → прямоугольники в координатах карты
const INSETS = [
  { id: 'moscow', title: 'Москва и Подмосковье', geo: [35.1, 54.2, 40.25, 56.98] },
  { id: 'spb', title: 'Санкт-Петербург и Ленобласть', geo: [27.6, 58.4, 35.8, 61.4] },
  { id: 'caucasus', title: 'Северный Кавказ', geo: [38.6, 41.15, 48.7, 46.1] },
  { id: 'crimea', title: 'Крым и Севастополь', geo: [32.4, 44.35, 36.7, 46.25] },
  { id: 'new', title: 'Новые регионы', geo: [31.2, 45.9, 40.3, 50.15] },
]
const insets = INSETS.map((ins) => {
  const [lo0, la0, lo1, la1] = ins.geo
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    pts.push(projection([lo0 + (lo1 - lo0) * t, la0]), projection([lo0 + (lo1 - lo0) * t, la1]))
    pts.push(projection([lo0, la0 + (la1 - la0) * t]), projection([lo1, la0 + (la1 - la0) * t]))
  }
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(Math.round)
  const ids = Object.entries(ordered)
    .filter(([, r]) => r.b[0] < rect[2] && r.b[2] > rect[0] && r.b[1] < rect[3] && r.b[3] > rect[1])
    .map(([id]) => id)
  return { id: ins.id, title: ins.title, rect, ids }
})


writeFileSync(
  `${OUT}/context.svg.json`,
  JSON.stringify({
    viewBox: [0, 0, VW, VH],
    land: join(land, 2500, VIEW, 14),
    lakes: join(lakes, 900),
    rivers: join(rivers),
    graticule: gratD,
    insets,
  }),
)

// Параметры проекции для скрипта рельефа
writeFileSync(
  `${CACHE}/projection.json`,
  JSON.stringify({ scale: projection.scale(), translate: projection.translate(), VW, VH }),
)

const size = (p) => (readFileSync(p).length / 1024).toFixed(0) + ' КБ'
console.log(`regions.svg.json: ${size(`${OUT}/regions.svg.json`)}, context.svg.json: ${size(`${OUT}/context.svg.json`)}`)
