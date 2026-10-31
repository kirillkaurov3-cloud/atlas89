import { useId } from 'react'
import type { Achievement } from '../lib/achievements'
import { Icon } from './Icon'

const TONES: Record<Achievement['tone'], [string, string, string]> = {
  lime: ['#E4FF8A', '#8FD400', '#10180a'],
  violet: ['#B6A6FF', '#5B3DF5', '#ffffff'],
  amber: ['#FFE08A', '#FF9F1C', '#2a1a00'],
  coral: ['#FFB0C0', '#FF4F7B', '#ffffff'],
  sky: ['#A8F0FF', '#19B8D6', '#04202a'],
}

/** Значок ачивки: скруглённый шестиугольник с градиентом и иконкой (SVG, без эмодзи). */
export function Badge({ a, unlocked, size = 64 }: { a: Achievement; unlocked: boolean; size?: number }) {
  const id = useId().replace(/:/g, '')
  const [c1, c2, ink] = TONES[a.tone]
  return (
    <span style={{ position: 'relative', display: 'inline-grid', placeItems: 'center', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={unlocked ? c1 : 'var(--glass-hover)'} />
            <stop offset="1" stopColor={unlocked ? c2 : 'var(--glass-strong)'} />
          </linearGradient>
        </defs>
        <path
          d="M32 3.5c1.6 0 3.1.4 4.5 1.2l17.6 10.2a9 9 0 0 1 4.5 7.8v20.6a9 9 0 0 1-4.5 7.8L36.5 61.3a9 9 0 0 1-9 0L9.9 51.1a9 9 0 0 1-4.5-7.8V22.7a9 9 0 0 1 4.5-7.8L27.5 4.7c1.4-.8 2.9-1.2 4.5-1.2Z"
          fill={`url(#${id}g)`}
          stroke={unlocked ? 'rgba(255,255,255,.55)' : 'var(--stroke-strong)'}
          strokeWidth="1.5"
          strokeDasharray={unlocked ? undefined : '3 3'}
        />
        {unlocked && <path d="M14 20c6-8 22-12 34-4" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="3" strokeLinecap="round" />}
      </svg>
      <span style={{ position: 'relative', color: unlocked ? ink : 'var(--text-faint)', display: 'grid' }}>
        <Icon name={a.icon} size={size * 0.4} strokeWidth={2.2} />
      </span>
    </span>
  )
}
