import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useSession } from '@/features/auth/session-store'
import { type EventListItem, useEvents } from './api'

type SelectedEventState = {
  /** The event each signed-in user last worked on (one browser may be shared by several people). */
  byUser: Record<string, string>
  select: (userId: string, eventId: string) => void
}

export const useSelectedEventStore = create<SelectedEventState>()(
  persist(
    (set) => ({
      byUser: {},
      select: (userId, eventId) => set((s) => ({ byUser: { ...s.byUser, [userId]: eventId } })),
    }),
    // Only ids, no event data: nothing private stays on the device.
    { name: 'evently.selected-event', storage: createJSONStorage(() => localStorage) },
  ),
)

/**
 * Which event the event menus (Guests, Check-in, Payments, Statistics) open (Q-59): the one the user
 * picked, otherwise the only Active event, otherwise the only event. Null when there is a real choice to make.
 */
export function pickEvent(events: EventListItem[], storedId: string | undefined): EventListItem | null {
  const stored = storedId ? events.find((e) => e.id === storedId) : undefined
  if (stored) return stored
  const active = events.filter((e) => e.status === 'Active')
  if (active.length === 1) return active[0]!
  if (events.length === 1) return events[0]!
  return null
}

export function useSelectedEvent() {
  const userId = useSession((s) => s.user?.id)
  const storedId = useSelectedEventStore((s) => (userId ? s.byUser[userId] : undefined))
  const store = useSelectedEventStore((s) => s.select)
  const events = useEvents()
  const list = events.data ?? []
  return {
    events: list,
    isLoading: events.isPending,
    selected: pickEvent(list, storedId),
    select: (eventId: string) => {
      if (userId) store(userId, eventId)
    },
  }
}
