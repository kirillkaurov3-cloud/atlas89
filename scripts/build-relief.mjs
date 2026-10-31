/**
 * Растр «физической карты» для режима «Как на доске»: низменности зелёные,
 * возвышенности жёлтые, горы коричневые. Строится из полигонов форм рельефа
 * Natural Earth (ne_10m_geography_regions_polys), размывается и сохраняется в public/relief.webp.
 *
 *   node scripts/build-map.mjs && node scripts/build-relief.mjs
 * Нужен Playwright (Chromium) — только на этапе подготовки данных.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { geoConicEqualArea, geoPath } from 'd3-geo'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_PATH || 'playwright')

const CACHE = 'scripts/.cache'
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'))
const P = readJSON(`${CACHE}/projection.json`)
const regions = readJSON('src/data/regions.svg.json')
const ctx = readJSON('src/data/context.svg.json')

const projection = geoConicEqualArea().rotate([-100, 0]).parallels([52, 64]).scale(P.scale).translate(P.translate)
const path = geoPath(projection)

function unwrap(geom) {
  const fix = (c) => (typeof c[0] === 'number' ? (c[0] < -90 ? [c[0] + 360, c[1]] : c) : c.map(fix))
  return { ...geom, coordinates: fix(geom.coordinates) }
}

const geo = readJSON(`${CACHE}/ne_10m_geography_regions_polys.geojson`)
const pick = (classes) =>
  geo.features
    .filter((f) => classes.includes(f.properties.FEATURECLA))
    .map((f) => path(unwrap(f.geometry)))
    .filter(Boolean)
    .join('')

const mountains = pick(['Range/mtn'])
const plateaus = pick(['Plateau'])
const lowlands = pick(['Lowland', 'Plain', 'Basin', 'Delta'])
const tundra = pick(['Tundra'])

const OUT_W = Number(process.env.RELIEF_W || 2400)
const OUT_H = Math.round((OUT_W * P.VH) / P.VW)
const k = OUT_W / P.VW
const landD = Object.values(regions.regions).map((r) => r.d).join('') + ctx.land

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${P.VW} ${P.VH}">
<defs>
  <clipPath id="land"><path d="${landD}" fill-rule="nonzero"/></clipPath>
  <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${18 / k / 4}"/></filter>
  <filter id="b1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${6 / k}"/></filter>
  <filter id="lo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${16 / k}"/></filter>
  <filter id="halo" x="-30%" y="-30%" width="160%" height="160%">
    <feMorphology operator="dilate" radius="${4 / k}"/><feGaussianBlur stdDeviation="${11 / k}"/>
  </filter>
  <filter id="core" x="-20%" y="-20%" width="140%" height="140%">
    <feMorphology operator="erode" radius="${4 / k}"/><feGaussianBlur stdDeviation="${5 / k}"/>
  </filter>
  <filter id="peak" x="-20%" y="-20%" width="140%" height="140%">
    <feMorphology operator="erode" radius="${8 / k}"/><feGaussianBlur stdDeviation="${4 / k}"/>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${0.012 / k}" numOctaves="5" seed="7"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.32  0 0 0 0 0.2  0 0 0 0 0.08  1.6 0 0 0 -0.75"/>
  </filter>
  <linearGradient id="north" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b9d6a0"/><stop offset=".55" stop-color="#9ccb7c"/><stop offset="1" stop-color="#a9cf7a"/>
  </linearGradient>
  <mask id="mtnMask"><path d="${mountains}" fill="#fff" filter="url(#core)"/></mask>
</defs>
<g clip-path="url(#land)">
  <rect width="${P.VW}" height="${P.VH}" fill="url(#north)"/>
  <path d="${tundra}" fill="#c6dcb0" filter="url(#b1)" opacity=".7"/>
  <path d="${lowlands}" fill="#78b85c" filter="url(#lo)" opacity=".75"/>
  <path d="${plateaus}" fill="#e8dc98" filter="url(#halo)" opacity=".9"/>
  <path d="${plateaus}" fill="#dcbf72" filter="url(#core)" opacity=".55"/>
  <path d="${mountains}" fill="#e8d48e" filter="url(#halo)"/>
  <path d="${mountains}" fill="#d3a462" filter="url(#b1)" opacity=".95"/>
  <path d="${mountains}" fill="#b67c45" filter="url(#core)" opacity=".8"/>
  <path d="${mountains}" fill="#8f5a2c" filter="url(#peak)" opacity=".55"/>
  <rect width="${P.VW}" height="${P.VH}" filter="url(#grain)" mask="url(#mtnMask)" opacity=".55"/>
</g>
</svg>`

writeFileSync(`${CACHE}/relief.svg`, svg)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: OUT_W, height: OUT_H }, deviceScaleFactor: 1 })
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
await page.waitForTimeout(500)
const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: OUT_W, height: OUT_H } })
// Перекодируем в webp через canvas самого браузера
const q = Number(process.env.RELIEF_Q || 0.72)
const dataUrl = await page.evaluate(
  async ({ b64, q }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    return c.toDataURL('image/webp', q)
  },
  { b64: png.toString('base64'), q },
)
await browser.close()
const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
writeFileSync('public/relief.webp', buf)
console.log(`public/relief.webp: ${OUT_W}×${OUT_H}, ${(buf.length / 1024).toFixed(0)} КБ`)
