import { createContext, use } from 'react'

type PickerContext = {
  /** Opens the picker; with `page`, the chosen event's page opens afterwards (e.g. "guests"). */
  openPicker: (page?: string) => void
}

export const EventPickerContext = createContext<PickerContext>({ openPicker: () => {} })

export function useEventPicker() {
  return use(EventPickerContext)
}
