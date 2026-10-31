import { m as motion } from 'framer-motion'

interface Props {
  value: number
  max: number
  size?: number
  stroke?: number
  color?: string
  label?: string
}

/** Кольцо прогресса с плавным заполнением. */
export function ProgressRing({ value, max, size = 80, stroke = 8, color = 'var(--lime)', label }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = max > 0 ? Math.min(1, value / max) : 0
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label ?? `${value} из ${max}`}
      style={{ flex: 'none', transform: 'rotate(-90deg)' }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--stroke-strong)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - frac) }}
        transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        style={{ filter: frac > 0 ? `drop-shadow(0 0 6px ${color})` : undefined }}
      />
    </svg>
  )
}
