import { useEffect, useState } from 'react'
import { loadMap, type MapData } from './geo'

/** Загружает геометрию карты (один раз на всё приложение). */
export function useMapData(): MapData | null {
  const [data, setData] = useState<MapData | null>(null)
  useEffect(() => {
    let alive = true
    loadMap().then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [])
  return data
}
