import { useEffect, useRef } from 'react'

interface Props {
  /** момент старта (performance.now()), null — кольцо пустое */
  startedAt: number | null
  /** длительность, мс; 0 — без таймера (кольцо считает вверх) */
  duration: number
  paused?: boolean
  size?: number
  stroke?: number
}

/** Кольцевой таймер. Обновляется через requestAnimationFrame напрямую в DOM — без ре-рендеров. */
export function CountdownRing({ startedAt, duration, paused = false, size = 64, stroke = 5 }: Props) {
  const circle = useRef<SVGCircleElement>(null)
  const text = useRef<SVGTextElement>(null)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const el = circle.current
      const tx = text.current
      if (!el || !tx) return
      if (startedAt == null) {
        el.style.strokeDashoffset = String(c)
        tx.textContent = ''
        return
      }
      const elapsed = performance.now() - startedAt
      if (duration > 0) {
        const left = Math.max(0, duration - elapsed)
        const frac = left / duration
        el.style.strokeDashoffset = String(c * (1 - frac))
        el.style.stroke = frac < 0.3 ? 'var(--coral)' : 'var(--lime)'
        tx.textContent = String(Math.ceil(left / 1000))
      } else {
        el.style.strokeDashoffset = '0'
        el.style.stroke = 'var(--violet-2)'
        tx.textContent = String(Math.floor(elapsed / 1000))
      }
      if (!paused) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [startedAt, duration, paused, c])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--stroke-strong)" strokeWidth={stroke} />
      <circle
        ref={circle}
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--lime)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke 0.3s' }}
      />
      <text
        ref={text}
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="currentColor"
        style={{ font: `700 ${Math.round(size * 0.32)}px var(--font-display)`, fontVariantNumeric: 'tabular-nums' }}
      />
    </svg>
  )
}
