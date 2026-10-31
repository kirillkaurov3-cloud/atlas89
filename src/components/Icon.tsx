import type { SVGProps } from 'react'

const PATHS = {
  pointer: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 1v4M12 19v4M1 12h4M19 12h4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  book: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5Zm0 15a2 2 0 0 0 2 2h13v-4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 18l-6-6 6-6',
  share: 'M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  check: 'M5 12.5 10 17.5 19 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-5-5',
  layers: 'M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5l10 5 10-5',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 10v4l2.5 2M9 2h6',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  play: 'M7 4v16l13-8L7 4Z',
  collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  neighbors: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M4 5h.01M20 5h.01M4 19h.01M20 19h.01M6 7l3.5 3M18 7l-3.5 3M6 17l3.5-3M18 17l-3.5-3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  download: 'M12 3v13M7 11l5 5 5-5M5 21h14',
  upload: 'M12 21V8M7 13l5-5 5 5M5 3h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const

export type IconName = keyof typeof PATHS

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 22, strokeWidth = 2, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
