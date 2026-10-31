/**
 * Иконки PWA, apple-touch-icon и Open Graph картинка (1200×630).
 * Рендерятся из SVG/HTML в Chromium (Playwright). Запуск: npm run assets
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_PATH || 'playwright')

const regions = JSON.parse(readFileSync('src/data/regions.svg.json', 'utf8'))
const ctx = JSON.parse(readFileSync('src/data/context.svg.json', 'utf8'))
const src = readFileSync('src/data/regions.ts', 'utf8')
// округ каждого региона из справочника (простым разбором файла)
const districtOf = {}
let current = null
for (const line of src.split('\n')) {
  const m = line.match(/^const (CFO|SZFO|YUFO|SKFO|PFO|UFO|SFO|DFO): R\[\]/)
  if (m) current = m[1].toLowerCase()
  const id = line.match(/(?:obl\('|id: ')([a-z-]+)'/)
  if (current && id) districtOf[id[1]] = current
}
const COLORS = { cfo: '#8b74ff', szfo: '#4aa3ff', yufo: '#ffb547', skfo: '#ff6f91', pfo: '#33d1a0', ufo: '#e8dc4f', sfo: '#45d3ea', dfo: '#ff8a5c' }
const [, , VW, VH] = regions.viewBox
const paths = Object.entries(regions.regions)
  .map(([id, g]) => `<path d="${g.d}" fill="${COLORS[districtOf[id]] ?? '#888'}" fill-opacity=".6" stroke="#fff" stroke-opacity=".7" stroke-width="10" fill-rule="evenodd"/>`)
  .join('')

const logo = (size, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${64 + pad * 2} ${64 + pad * 2}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9B83FF"/><stop offset="1" stop-color="#5B3DF5"/></linearGradient></defs>
<rect x="${-pad}" y="${-pad}" width="${64 + pad * 2}" height="${64 + pad * 2}" rx="${pad ? 0 : 18}" fill="url(#g)"/>
<path d="M12 38 19 24l11 3 7-9 13 5 3 12-8 9-14-2-7 6-9-4Z" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>
<circle cx="33" cy="34" r="9" fill="none" stroke="#C6FF3D" stroke-width="3.5"/><circle cx="33" cy="34" r="3.2" fill="#C6FF3D"/></svg>`

const fontCss = (() => {
  const f = (p) => readFileSync(p).toString('base64')
  const dir = 'node_modules/@fontsource/unbounded/files/'
  const man = 'node_modules/@fontsource-variable/manrope/files/'
  return `@font-face{font-family:U;font-weight:700;src:url(data:font/woff2;base64,${f(dir + 'unbounded-cyrillic-700-normal.woff2')})}
@font-face{font-family:U;font-weight:700;src:url(data:font/woff2;base64,${f(dir + 'unbounded-latin-700-normal.woff2')});unicode-range:U+0000-00FF}
@font-face{font-family:M;font-weight:200 800;src:url(data:font/woff2;base64,${f(man + 'manrope-cyrillic-wght-normal.woff2')})}
@font-face{font-family:M;font-weight:200 800;src:url(data:font/woff2;base64,${f(man + 'manrope-latin-wght-normal.woff2')});unicode-range:U+0000-00FF}`
})()

const og = `<html><head><style>${fontCss}
body{margin:0;width:1200px;height:630px;overflow:hidden;background:#070a16;font-family:M,sans-serif;color:#f2f4ff;position:relative}
.b{position:absolute;border-radius:50%;filter:blur(90px)}
.t{position:absolute;left:72px;top:70px;width:560px}
h1{text-shadow:0 4px 30px #070a16;font-family:U;font-weight:700;font-size:96px;letter-spacing:-.04em;margin:28px 0 0;line-height:1}
p{font-size:34px;font-weight:700;line-height:1.25;margin:26px 0 0;color:rgba(226,231,255,.8)}
.chips{display:flex;gap:12px;margin-top:40px}
.chip{padding:12px 22px;border-radius:999px;font-weight:800;font-size:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15)}
.lime{background:#C6FF3D;color:#10180a;border-color:transparent}
.map{position:absolute;right:-150px;top:130px;width:740px}
</style></head><body>
<div class="b" style="width:700px;height:700px;left:-200px;top:-300px;background:#5b3dff;opacity:.55"></div>
<div class="b" style="width:600px;height:600px;right:-150px;top:150px;background:#00a3ff;opacity:.35"></div>
<div class="b" style="width:400px;height:400px;left:300px;bottom:-250px;background:#9dff2e;opacity:.18"></div>
<svg class="map" viewBox="0 0 ${VW} ${VH}">${paths}</svg>
<div class="t">${logo(96)}<h1>Атлас 89</h1><p>Найди регион на карте<br>и назови столицу</p>
<div class="chips"><span class="chip lime">89 субъектов РФ</span><span class="chip">к зачёту</span></div></div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
const render = async (html, w, h, out, type = 'png') => {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`)
  await page.waitForTimeout(150)
  const buf = await page.screenshot({ type, quality: type === 'jpeg' ? 88 : undefined, omitBackground: type === 'png', clip: { x: 0, y: 0, width: w, height: h } })
  writeFileSync(out, buf)
  console.log(out, (buf.length / 1024).toFixed(0) + ' КБ')
}
await render(logo(192), 192, 192, 'public/icon-192.png')
await render(logo(512), 512, 512, 'public/icon-512.png')
await render(logo(512, 10), 512, 512, 'public/icon-maskable-512.png')
await render(logo(180, 4), 180, 180, 'public/apple-touch-icon.png')
await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(og)
await page.waitForTimeout(600)
const buf = await page.screenshot({ type: 'jpeg', quality: 86 })
writeFileSync('public/og.jpg', buf)
console.log('public/og.jpg', (buf.length / 1024).toFixed(0) + ' КБ')
await browser.close()
