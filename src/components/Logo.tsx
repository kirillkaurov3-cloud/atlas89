import { useId } from 'react'

/** Знак приложения: фиолетовый «скруглённый квадрат» с полигоном-регионом и лаймовой меткой. */
export function Logo({ size = 32 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9B83FF" />
          <stop offset="1" stopColor="#5B3DF5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}g)`} />
      <path d="M12 38 19 24l11 3 7-9 13 5 3 12-8 9-14-2-7 6-9-4Z" fill="#fff" fillOpacity=".18" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="33" cy="34" r="9" fill="none" stroke="#C6FF3D" strokeWidth="3.5" />
      <circle cx="33" cy="34" r="3.2" fill="#C6FF3D" />
    </svg>
  )
}
