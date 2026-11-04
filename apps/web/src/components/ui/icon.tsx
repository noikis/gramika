import type { ComponentProps } from 'react'

const materialNames = {
  book: 'menu_book',
  correction: 'edit_note',
  settings: 'settings',
  install: 'download',
  copy: 'content_copy',
  paste: 'content_paste',
  plus: 'add',
  check: 'check',
  pen: 'edit',
  chevronDown: 'keyboard_arrow_down',
  minus: 'remove',
  sparkles: 'auto_awesome',
  star4: 'stars',
  history: 'history',
  trash: 'delete',
  info: 'info',
  error: 'error',
  close: 'close',
  search: 'search',
  filters: 'tune',
  reset: 'restart_alt',
  arrowLeft: 'arrow_back',
  arrowRight: 'arrow_forward',
  chevronLeft: 'chevron_left',
  chevronRight: 'chevron_right',
  system: 'desktop_windows',
  light: 'light_mode',
  dark: 'dark_mode',
  volume: 'volume_up',
  translate: 'translate',
  pause: 'pause',
  play: 'play_arrow',
} as const

export function Icon({
  name,
  className,
  ...props
}: ComponentProps<'span'> & { name: keyof typeof materialNames }) {
  return (
    <span
      className={`material-symbols-rounded${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      {...props}
    >
      {materialNames[name]}
    </span>
  )
}
