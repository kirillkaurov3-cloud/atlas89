/** Скачивает исходные геоданные в scripts/.cache (нужно только для пересборки карты). */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'

const CACHE = 'scripts/.cache'
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const FILES = {
  'russia_regions.geojson': 'https://raw.githubusercontent.com/hairymax/offline_russia_plotly/main/data/russia_regions.geojson',
  'ne_10m_admin_1.geojson': `${NE}/ne_10m_admin_1_states_provinces.geojson`,
  'ne_50m_admin_0_countries.geojson': `${NE}/ne_50m_admin_0_countries.geojson`,
  'ne_10m_lakes.geojson': `${NE}/ne_10m_lakes.geojson`,
  'ne_10m_rivers_lake_centerlines.geojson': `${NE}/ne_10m_rivers_lake_centerlines.geojson`,
  'ne_10m_geography_regions_polys.geojson': `${NE}/ne_10m_geography_regions_polys.geojson`,
}
mkdirSync(CACHE, { recursive: true })
for (const [name, url] of Object.entries(FILES)) {
  const path = `${CACHE}/${name}`
  if (existsSync(path)) {
    console.log(`есть: ${name}`)
    continue
  }
  process.stdout.write(`качаю ${name}… `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  console.log('ok')
}
