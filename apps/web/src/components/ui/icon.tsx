import type { ComponentProps } from 'react'

const paths = {
  correction: 'M4 20l4-1 12-12-3-3L5 16z M14 7l3 3 M4 20h16',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  install: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  copy: 'M9 9h11v11H9z M15 9V4H4v11h5',
  paste: 'M9 5H5v16h14V5h-4 M9 3h6v5H9z',
  plus: 'M12 5v14 M5 12h14',
  history: 'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2',
  trash: 'M4 7h16 M9 7V4h6v3 M7 7l1 14h8l1-14 M10 11v6 M14 11v6',
  info: 'M12 11v6 M12 7h.01',
  error: 'M12 7v6 M12 17h.01',
  close: 'M6 6l12 12 M18 6 6 18',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',
  filters: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  reset: 'M3 10a9 9 0 1 1 1 7 M3 4v6h6',
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  chevronLeft: 'M16 4l-9 8 9 8',
  chevronRight: 'M8 4l9 8-9 8',
  system: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  light:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
  dark: 'M20 14a8 8 0 0 1-10-10 9 9 0 1 0 10 10Z',
} as const

export function Icon({ name, ...props }: ComponentProps<'svg'> & { name: keyof typeof paths }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {(name === 'info' || name === 'error') && <circle cx="12" cy="12" r="9" />}
      <path d={paths[name]} />
    </svg>
  )
}
