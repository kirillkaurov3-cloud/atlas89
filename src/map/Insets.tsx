import { AnimatePresence, motion } from 'framer-motion'
import { memo, useRef } from 'react'
import { REGION_BY_ID } from '../data/regions'
import { Icon } from '../components/Icon'
import { updateSettings, useStore } from '../lib/store'
import { pickRegion, type MapData } from './geo'
import type { MapEffect, MapPalette, MapStyleMode, RegionState } from './MapView'
import m from './MapView.module.css'
import s from './Insets.module.css'

interface Props {
  data: MapData
  styleMode: MapStyleMode
  palette?: MapPalette
  states?: Record<string, RegionState | undefined>
  effects?: MapEffect[]
  onRegionClick?: (id: string, info: { proximity: boolean }) => void
  selectable?: (id: string) => boolean
  /** Показать только эти врезки */
  only?: string[]
  layout?: 'strip' | 'grid' | 'column'
  className?: string
}

/** Врезки «как в атласе»: мелкие регионы в увеличенном масштабе. */
export function Insets({ only, layout = 'strip', className, ...rest }: Props) {
  const collapsed = useStore((st) => st.settings.insetsCollapsed)
  const list = rest.data.insets.filter((i) => !only || only.includes(i.id))
  return (
    <div className={`${s.root} ${s[layout]} ${className ?? ''}`}>
      <button
        className={s.toggle}
        onClick={() => updateSettings({ insetsCollapsed: !collapsed })}
        aria-expanded={!collapsed}
      >
        <Icon name={collapsed ? 'expand' : 'collapse'} size={14} />
        {collapsed ? 'Показать врезки' : 'Врезки'}
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className={s.list}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {list.map((ins) => (
              <Inset key={ins.id} inset={ins} {...rest} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const Inset = memo(function Inset({
  inset,
  data,
  styleMode,
  palette = 'district',
  states,
  effects,
  onRegionClick,
  selectable,
}: Omit<Props, 'only' | 'layout' | 'className'> & { inset: MapData['insets'][number] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [x0, y0, x1, y1] = inset.rect
  const w = x1 - x0
  const h = y1 - y0

  const onClick = (e: React.MouseEvent) => {
    if (!onRegionClick || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const scale = Math.min(r.width / w, r.height / h)
    // preserveAspectRatio=xMidYMid slice/meet: пересчитываем координаты
    const offX = (r.width - w * scale) / 2
    const offY = (r.height - h * scale) / 2
    const x = x0 + (e.clientX - r.left - offX) / scale
    const y = y0 + (e.clientY - r.top - offY) / scale
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const raw = el?.closest?.('[data-id]')?.getAttribute('data-id') ?? null
    const direct = raw && (!selectable || selectable(raw)) ? raw : null
    const ids = selectable ? inset.ids.filter(selectable) : inset.ids
    const { id, proximity } = pickRegion({ regions: data.regions, ids, x, y, scale, directId: direct, radiusPx: 10 })
    if (id) onRegionClick(id, { proximity })
  }

  const effs = effects?.filter((ef) => inset.ids.includes(ef.id))

  return (
    <figure className={`glass ${s.card}`} style={{ aspectRatio: `${w} / ${h}` }}>
      <div className={`${m.wrap} ${styleMode === 'board' ? m.board : m.study} ${palette === 'neutral' ? m.neutral : ''}`}>
        <svg
          ref={svgRef}
          className={`${m.svg} ${s.svg}`}
          viewBox={`${x0} ${y0} ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={onClick}
          role="img"
          aria-label={`Врезка: ${inset.title}`}
          style={{ ['--px' as string]: String(w / 300) }}
        >
          {styleMode === 'board' && <rect className={m.sea} x={x0} y={y0} width={w} height={h} />}
          {styleMode === 'board' && (
            <image
              href={`${import.meta.env.BASE_URL}relief.webp`}
              x={0}
              y={0}
              width={data.width}
              height={data.height}
              preserveAspectRatio="none"
              className={m.relief}
            />
          )}
          <path className={m.land} d={data.land} />
          <g>
            {inset.ids.map((id) => {
              const g = data.regions[id]
              const meta = REGION_BY_ID[id]
              return (
                <path
                  key={id}
                  data-id={id}
                  data-state={states?.[id]}
                  className={`${m.region} ${m['d_' + meta?.district]}`}
                  d={g.d}
                  fillRule="evenodd"
                >
                  <title>{meta?.name}</title>
                </path>
              )
            })}
          </g>
          <path className={m.lakes} d={data.lakes} />
          {effs?.map((ef) => {
            const g = data.regions[ef.id]
            if (ef.kind === 'trace')
              return (
                <g key={ef.key} className={m.effects}>
                  <path className={m.traceGlow} d={g.d} pathLength={1} />
                  <path className={m.trace} d={g.d} pathLength={1} />
                </g>
              )
            return (
              <path key={ef.key} className={`${m.effects} ${ef.kind === 'flash' ? m.flash : m.shake}`} d={g.d} fillRule="evenodd" />
            )
          })}
        </svg>
      </div>
      {styleMode !== 'board' && <figcaption className={s.caption}>{inset.title}</figcaption>}
    </figure>
  )
})
