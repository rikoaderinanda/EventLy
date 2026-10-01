import { useSyncExternalStore } from 'react'

const desktopQuery = '(min-width: 40rem)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(desktopQuery)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

/** True on tablet and desktop widths (centred modal), false on phones (bottom sheet). */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(desktopQuery).matches ?? true,
    () => true,
  )
}
