import { updateSettings, useStore } from '../lib/store'
import { Icon } from '../components/Icon'

/** Кнопка переключения «Учебный» ↔ «Как на доске». */
export function MapStyleToggle() {
  const mode = useStore((s) => s.settings.mapStyle)
  const next = mode === 'study' ? 'board' : 'study'
  return (
    <button
      className="icon-btn"
      aria-label={mode === 'study' ? 'Режим «Как на доске»' : 'Учебный режим карты'}
      title={mode === 'study' ? 'Как на доске' : 'Учебная карта'}
      onClick={() => updateSettings({ mapStyle: next })}
      style={mode === 'board' ? { background: 'var(--lime)', color: 'var(--lime-ink)' } : undefined}
    >
      <Icon name="layers" size={19} />
    </button>
  )
}
