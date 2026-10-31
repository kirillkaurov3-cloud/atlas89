import { AnimatePresence, m as motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { DISTRICTS, DISTRICT_BY_ID, REGIONS, REGION_BY_ID, type Region } from '../data/regions'
import { Icon } from '../components/Icon'
import { MapLayout } from '../components/MapLayout'
import { Insets } from '../map/Insets'
import { MapView, type MapCamera, type RegionState } from '../map/MapView'
import { MapStyleToggle } from '../map/MapStyleToggle'
import { useMapData } from '../map/useMapData'
import { useStore } from '../lib/store'
import { norm, plural } from '../lib/text'
import { capitalLabel } from '../lib/capitals'
import s from './Reference.module.css'

function searchRegions(q: string): Region[] {
  const n = norm(q)
  if (!n) return []
  const scored: [number, Region][] = []
  for (const r of REGIONS) {
    const names = [r.name, r.short, ...r.aliases].map(norm)
    const caps = [r.capital, r.capitalAlt].filter(Boolean).map((c) => norm(c!))
    let score = 0
    if (names.some((x) => x.startsWith(n))) score = 3
    else if (names.some((x) => x.split(' ').some((w) => w.startsWith(n)))) score = 2
    else if (caps.some((c) => c.startsWith(n))) score = 1.5
    else if (names.some((x) => x.includes(n)) || caps.some((c) => c.includes(n))) score = 1
    if (score) scored.push([score, r])
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'ru')).map((x) => x[1])
}

export function Reference() {
  const data = useMapData()
  const mapStyle = useStore((st) => st.settings.mapStyle)
  const prefs = useStore((st) => st.settings.capitalPrefs)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const camera = useRef<MapCamera>(null)

  const results = useMemo(() => searchRegions(query), [query])

  const states = useMemo(() => {
    const st: Record<string, RegionState> = {}
    if (query && results.length) for (const r of results) st[r.id] = 'match'
    if (selected) st[selected] = 'selected'
    return st
  }, [results, query, selected])

  const select = (id: string, fly = true) => {
    setSelected(id)
    if (fly) camera.current?.flyTo(id, { duration: 900, fill: 0.55, maxZoom: 16 })
  }

  const region = selected ? REGION_BY_ID[selected] : null
  const neighbors = selected && data ? data.regions[selected].n : []

  const search = (
    <div className={s.searchWrap}>
      <label className={`glass ${s.search}`}>
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Регион или столица…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              select(results[0].id)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          aria-label="Поиск региона"
          enterKeyHint="search"
          autoComplete="off"
        />
        {query && (
          <button className={s.clear} aria-label="Очистить" onClick={() => setQuery('')}>
            <Icon name="close" size={16} />
          </button>
        )}
      </label>
      <AnimatePresence>
        {focused && query && (
          <motion.ul
            className={`glass ${s.results}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            role="listbox"
          >
            {results.slice(0, 8).map((r) => (
              <li key={r.id}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    select(r.id)
                    setFocused(false)
                    ;(document.activeElement as HTMLElement)?.blur()
                  }}
                >
                  <span className={s.resName}>{r.name}</span>
                  <span className={s.resMeta}>
                    {r.capital ? capitalLabel(r, prefs) : 'город федерального значения'} · {DISTRICT_BY_ID[r.district].short}
                  </span>
                </button>
              </li>
            ))}
            {!results.length && <li className={s.empty}>Ничего не нашлось</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )

  const card = (
    <AnimatePresence mode="popLayout">
      {region ? (
        <motion.section
          key={region.id}
          className={`glass ${s.card}`}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          aria-live="polite"
        >
          <div className={s.cardHead}>
            <div>
              <div className={s.chips}>
                <span className={`chip ${s.districtChip}`} style={{ ['--dc' as string]: `var(--d-${region.district})` }}>
                  {DISTRICT_BY_ID[region.district].short}
                </span>
                <span className="chip">{region.type}</span>
              </div>
              <h2 className={s.cardTitle}>{region.name}</h2>
            </div>
            <button className="icon-btn" aria-label="Закрыть" onClick={() => setSelected(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <dl className={s.facts}>
            <div>
              <dt>Столица</dt>
              <dd>
                {region.capital ? (
                  <>
                    <strong>{capitalLabel(region, prefs)}</strong>
                    {region.capitalNote && <span className={s.note}>{region.capitalNote}</span>}
                  </>
                ) : (
                  <span className={s.note}>Город федерального значения — сам себе столица</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Округ</dt>
              <dd>{DISTRICT_BY_ID[region.district].name}</dd>
            </div>
            <div>
              <dt>
                Соседи{neighbors.length ? ` · ${neighbors.length}` : ''}
              </dt>
              <dd className={s.neighbors}>
                {neighbors.length ? (
                  neighbors.map((n) => (
                    <button key={n} className="chip" onClick={() => select(n)}>
                      {REGION_BY_ID[n].short}
                    </button>
                  ))
                ) : (
                  <span className={s.note}>Нет сухопутных границ с другими субъектами</span>
                )}
              </dd>
            </div>
          </dl>
        </motion.section>
      ) : (
        <motion.div key="hint" className={s.hintWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <p className={s.hint}>
            Нажми на регион или найди его через поиск.{' '}
            {query && results.length > 0 && `${results.length} ${plural(results.length, ['совпадение', 'совпадения', 'совпадений'])} подсвечено.`}
          </p>
          <div className={`glass ${s.legend}`}>
            {DISTRICTS.map((d) => {
              const ids = REGIONS.filter((r) => r.district === d.id).map((r) => r.id)
              return (
                <button key={d.id} className={s.legendItem} onClick={() => camera.current?.flyTo(ids, { duration: 900, fill: 0.85 })}>
                  <span className={s.dot} style={{ background: `var(--d-${d.id})` }} />
                  <span className={s.legendName}>{d.name.replace(' федеральный округ', '')}</span>
                  <span className={s.legendCount}>{ids.length}</span>
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <MapLayout
      title="Справочник"
      headerRight={<MapStyleToggle />}
      top={search}
      map={
        data && (
          <MapView
            data={data}
            styleMode={mapStyle}
            states={states}
            onRegionClick={(id) => select(id, false)}
            hoverLabel
            insetFrames
            cameraRef={camera}
          />
        )
      }
      insets={
        data && (
          <Insets data={data} styleMode={mapStyle} states={states} onRegionClick={(id) => select(id, false)} />
        )
      }
      panel={card}
    />
  )
}
