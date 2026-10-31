import { AnimatePresence, m as motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { REGIONS, REGION_BY_ID } from '../../data/regions'
import { Icon } from '../../components/Icon'
import { MapLayout } from '../../components/MapLayout'
import { Insets } from '../../map/Insets'
import { MapView, type MapCamera, type MapEffect, type RegionState } from '../../map/MapView'
import { MapStyleToggle } from '../../map/MapStyleToggle'
import { useMapData } from '../../map/useMapData'
import { emit } from '../../lib/events'
import { shuffle } from '../../lib/random'
import { navigate } from '../../lib/router'
import { useStore } from '../../lib/store'
import { plural } from '../../lib/text'
import q from '../shared/Quiz.module.css'

const ROUND = 5

/** «Соседи»: дан регион — нажми всех его соседей. Соседство посчитано скриптом по общим границам. */
export function Neighbors() {
  const data = useMapData()
  const mapStyle = useStore((s) => s.settings.mapStyle)
  const camera = useRef<MapCamera>(null)
  const [round, setRound] = useState(0)
  const order = useMemo(
    () => (data ? shuffle(REGIONS.filter((r) => data.regions[r.id].n.length >= 2).map((r) => r.id)).slice(0, ROUND) : []),
    // новый набор на каждый раунд
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, round],
  )
  const [index, setIndex] = useState(0)
  const [found, setFound] = useState<string[]>([])
  const [errors, setErrors] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const [effects, setEffects] = useState<MapEffect[]>([])
  const [total, setTotal] = useState({ ok: 0, all: 0, errors: 0 })
  const effKey = useRef(0)

  const id = order[index]
  const neighbors = id && data ? data.regions[id].n : []
  const done = neighbors.length > 0 && (found.length === neighbors.length || gaveUp)
  const finished = index >= order.length && order.length > 0

  useEffect(() => {
    if (id && data) camera.current?.flyTo([id, ...data.regions[id].n], { duration: 900, fill: 0.8, maxZoom: 16 })
  }, [id, data])

  const addEffect = (rid: string, kind: MapEffect['kind']) => {
    const key = `n${effKey.current++}`
    setEffects((e) => [...e, { key, id: rid, kind }])
    setTimeout(() => setEffects((e) => e.filter((x) => x.key !== key)), 1000)
  }

  const onRegion = (rid: string) => {
    if (!id || done || rid === id || found.includes(rid)) return
    if (neighbors.includes(rid)) {
      setFound((f) => [...f, rid])
      addEffect(rid, 'flash')
      emit('answer', { mode: 'neighbors', kind: 'find', regionId: rid, ok: true, mapStyle })
    } else {
      setErrors((e) => e + 1)
      addEffect(rid, 'shake')
    }
  }

  const next = () => {
    setTotal((t) => ({ ok: t.ok + found.length, all: t.all + neighbors.length, errors: t.errors + errors }))
    setFound([])
    setErrors(0)
    setGaveUp(false)
    setIndex((i) => i + 1)
  }

  const states = useMemo(() => {
    const st: Record<string, RegionState> = {}
    if (!id) return st
    st[id] = 'selected'
    for (const f of found) st[f] = 'found'
    if (gaveUp) for (const n of neighbors) if (!found.includes(n)) st[n] = 'match'
    return st
  }, [id, found, gaveUp, neighbors])

  if (finished)
    return (
      <div className={q.setup}>
        <div className={`${q.setupInner} ${q.results}`}>
          <header className={q.setupHead}>
            <button className="icon-btn" aria-label="Назад" onClick={() => navigate('/')}>
              <Icon name="back" size={20} />
            </button>
            <h1>Соседи: итоги</h1>
          </header>
          <section className={`glass ${q.section}`} style={{ textAlign: 'center' }}>
            <div className={q.bigNum}>
              {total.ok}/{total.all}
            </div>
            <p className={q.lead}>
              соседей найдено · {total.errors} {plural(total.errors, ['промах', 'промаха', 'промахов'])}
            </p>
          </section>
          <div className={q.resultActions}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setIndex(0)
                setTotal({ ok: 0, all: 0, errors: 0 })
                setRound((r) => r + 1)
              }}
            >
              Ещё раунд
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              На главную
            </button>
          </div>
        </div>
      </div>
    )

  if (!id) return null
  const region = REGION_BY_ID[id]

  const question = (
    <div className={`glass ${q.question}`} aria-live="polite" style={{ paddingLeft: 18 }}>
      <div className={q.qBody}>
        <div className={q.kicker}>Нажми всех соседей</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={id} className={q.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {region.name}
          </motion.div>
        </AnimatePresence>
        <div className={`${q.feedback} ${done && !gaveUp ? q.ok : ''}`}>
          Найдено {found.length} из {neighbors.length}
          {errors ? ` · промахов ${errors}` : ''}
        </div>
      </div>
      <span className={q.counter}>
        {index + 1}/{order.length}
      </span>
    </div>
  )

  const panel = (
    <div className={q.actions}>
      {done ? (
        <button className="btn btn-primary" onClick={next} autoFocus>
          Дальше
        </button>
      ) : (
        <button className="btn btn-ghost" onClick={() => setGaveUp(true)}>
          Показать оставшихся
        </button>
      )}
    </div>
  )

  return (
    <MapLayout
      title="Соседи"
      headerRight={<MapStyleToggle />}
      top={question}
      map={data && <MapView data={data} styleMode={mapStyle} states={states} effects={effects} onRegionClick={onRegion} cameraRef={camera} insetFrames />}
      insets={data && <Insets data={data} styleMode={mapStyle} states={states} effects={effects} onRegionClick={onRegion} />}
      panel={panel}
    />
  )
}
