import { MapView } from '../map/MapView'
import { useMapData } from '../map/useMapData'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { Home } from './Home'

/** Главный экран с живой картой: регионы медленно «дышат» волной с запада на восток. */
export function HomeScreen() {
  const data = useMapData()
  const mapStyle = useStore((s) => s.settings.mapStyle)
  return (
    <Home
      mapSlot={
        data ? (
          <div
            style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
            onClick={() => navigate('/reference')}
            role="link"
            aria-label="Открыть справочник"
          >
            <MapView data={data} styleMode={mapStyle} ambient interactive={false} controls={false} hover={false} />
          </div>
        ) : undefined
      }
    />
  )
}
