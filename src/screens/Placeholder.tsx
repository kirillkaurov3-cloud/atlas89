import { Icon } from '../components/Icon'
import { navigate } from '../lib/router'

/** Временная заглушка для экранов, которые появятся на следующих этапах. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="glass" style={{ padding: 28, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, marginBottom: 10 }}>{title}</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: 20 }}>Этот режим появится на следующем этапе.</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <Icon name="back" size={18} /> На главную
        </button>
      </div>
    </div>
  )
}
