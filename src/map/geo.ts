/**
 * Загрузка подготовленной геометрии (см. scripts/build-map.mjs) и геометрические утилиты.
 * В рантайме d3-geo не нужен: координаты уже спроецированы в пространство viewBox.
 */

export interface RegionGeo {
  /** SVG path */
  d: string
  /** Центральная точка (полюс недоступности самого большого полигона) */
  c: [number, number]
  /** bbox: x0, y0, x1, y1 */
  b: [number, number, number, number]
  /** Площадь в ед.² */
  a: number
  /** Соседи по границе */
  n: string[]
}

export interface InsetGeo {
  id: string
  title: string
  rect: [number, number, number, number]
  ids: string[]
}

export interface MapData {
  width: number
  height: number
  regions: Record<string, RegionGeo>
  land: string
  lakes: string
  rivers: string
  graticule: string
  insets: InsetGeo[]
}

let cache: Promise<MapData> | null = null

export function loadMap(): Promise<MapData> {
  if (!cache) {
    cache = Promise.all([import('../data/regions.svg.json'), import('../data/context.svg.json')]).then(
      ([r, c]) => {
        const reg = r.default as unknown as { viewBox: number[]; regions: Record<string, RegionGeo> }
        const ctx = c.default as unknown as Omit<MapData, 'width' | 'height' | 'regions'>
        return {
          width: reg.viewBox[2],
          height: reg.viewBox[3],
          regions: reg.regions,
          land: ctx.land,
          lakes: ctx.lakes,
          rivers: ctx.rivers,
          graticule: ctx.graticule,
          insets: ctx.insets as InsetGeo[],
        }
      },
    )
  }
  return cache
}

/** Начать загрузку заранее (например, на главном экране). */
export function preloadMap() {
  void loadMap()
}

// ---------- Кольца полигонов для точного попадания ----------
const ringsCache = new Map<string, number[][]>()

/** Разбирает компактный path (M x y l dx dy … z) в массивы колец [x0,y0,x1,y1,…]. */
export function ringsOf(id: string, d: string): number[][] {
  const hit = ringsCache.get(id)
  if (hit) return hit
  const rings: number[][] = []
  const parts = d.split('M')
  for (const part of parts) {
    if (!part) continue
    const body = part.replace(/z$/i, '')
    const [start, ...rest] = body.split('l')
    const s = start.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    let x = s[0]
    let y = s[1]
    const ring = [x, y]
    const nums = rest.join(' ').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    for (let i = 0; i + 1 < nums.length; i += 2) {
      x += nums[i]
      y += nums[i + 1]
      ring.push(x, y)
    }
    rings.push(ring)
  }
  ringsCache.set(id, rings)
  return rings
}

/** Расстояние от точки до границы региона; 0, если точка внутри (even-odd). */
export function distanceToRegion(id: string, g: RegionGeo, px: number, py: number): number {
  const rings = ringsOf(id, g.d)
  let inside = false
  let best = Infinity
  for (const r of rings) {
    const n = r.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = r[i * 2]
      const yi = r[i * 2 + 1]
      const xj = r[j * 2]
      const yj = r[j * 2 + 1]
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
      // расстояние до отрезка
      const dx = xj - xi
      const dy = yj - yi
      const len2 = dx * dx + dy * dy
      let t = len2 ? ((px - xi) * dx + (py - yi) * dy) / len2 : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const ex = xi + t * dx - px
      const ey = yi + t * dy - py
      const d2 = ex * ex + ey * ey
      if (d2 < best) best = d2
    }
  }
  return inside ? 0 : Math.sqrt(best)
}

export type Rect = [number, number, number, number]

export function unionBBox(regions: Record<string, RegionGeo>, ids: string[]): Rect | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const id of ids) {
    const g = regions[id]
    if (!g) continue
    x0 = Math.min(x0, g.b[0])
    y0 = Math.min(y0, g.b[1])
    x1 = Math.max(x1, g.b[2])
    y1 = Math.max(y1, g.b[3])
  }
  return x0 === Infinity ? null : [x0, y0, x1, y1]
}

/**
 * Выбор региона по точке с «расширенной зоной касания»:
 *  1) тап в пустое место (море, соседняя страна) — ближайший мелкий регион
 *     (на экране меньше smallPx) в радиусе radiusPx;
 *  2) тап прямо в регион — засчитываем его; перехватить может только
 *     сверхмелкий сосед (меньше tinyPx: Москва, СПб, Севастополь, Ингушетия
 *     при общем плане), если тап пришёлся в паре пикселей от него;
 *  3) иначе — ничего.
 */
export function pickRegion(opts: {
  regions: Record<string, RegionGeo>
  ids: Iterable<string>
  x: number
  y: number
  /** экранных пикселей в одной единице карты */
  scale: number
  directId: string | null
  smallPx?: number
  tinyPx?: number
  radiusPx?: number
  /** Разрешить перехват при прямом попадании (для пальца — да, для мыши — нет) */
  stealFromDirect?: boolean
}): { id: string | null; proximity: boolean } {
  const { regions, x, y, scale, directId, smallPx = 24, tinyPx = 8, radiusPx = 12, stealFromDirect = true } = opts
  const screenSize = (g: RegionGeo) => Math.max(g.b[2] - g.b[0], g.b[3] - g.b[1]) * scale
  const direct = directId ? regions[directId] : null
  if (direct && (screenSize(direct) < tinyPx || !stealFromDirect)) return { id: directId, proximity: false }
  // Попали в обычный регион — перехват только крошечным соседом и на меньшем радиусе
  const limitPx = direct ? tinyPx : smallPx
  const r = (direct ? radiusPx * 0.4 : radiusPx) / scale
  let best: string | null = null
  let bestD = Infinity
  const directSize = direct ? screenSize(direct) : Infinity
  for (const id of opts.ids) {
    if (id === directId) continue
    const g = regions[id]
    if (!g) continue
    const size = screenSize(g)
    if (size >= limitPx) continue
    // при прямом попадании перехватывает только тот, кто минимум втрое меньше
    if (direct && size * 3 > directSize) continue
    if (x < g.b[0] - r || x > g.b[2] + r || y < g.b[1] - r || y > g.b[3] + r) continue
    const d = distanceToRegion(id, g, x, y)
    if (d <= r && d < bestD) {
      bestD = d
      best = id
    }
  }
  if (best) return { id: best, proximity: true }
  return { id: directId, proximity: false }
}
