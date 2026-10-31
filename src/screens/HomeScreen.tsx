import { useMemo } from 'react'
import { MapView, type RegionState } from '../map/MapView'
import { CAPTURED_LEVEL, useCapture } from '../lib/leitner'
import { useMapData } from '../map/useMapData'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Home } from './Home'

/** Главный экран с живой картой: регионы медленно «дышат» волной с запада на восток. */
export function HomeScreen() {
  const data = useMapData()
  const mapStyle = useStore((s) => s.settings.mapStyle)
  const capture = useCapture()
  const states = useMemo(() => {
    const st: Record<string, RegionState> = {}
    for (const [id, c] of Object.entries(capture.cards)) if (c.level >= CAPTURED_LEVEL) st[id] = 'captured'
    return st
  }, [capture])
  return (
    <Home
      captured={Object.keys(states).length}
      mapSlot={
        data ? (
          <div
            style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
            onClick={() => navigate('/reference')}
            role="link"
            aria-label="Открыть справочник"
          >
            <MapView data={data} styleMode={mapStyle} states={states} ambient interactive={false} controls={false} hover={false} />
          </div>
        ) : undefined
      }
    />
  )
}
