import { useTranslation } from 'react-i18next'
import { EventCard } from '@/components/event/EventCard'
import type { EventListItem } from './api'
import { formatEventDate } from './format'

/** An event of the list as a card, with its counts. */
export function EventListCard({ event }: { event: EventListItem }) {
  const { i18n } = useTranslation()
  return (
    <EventCard
      to={`/app/events/${event.id}`}
      name={event.name}
      category={event.category}
      status={event.status}
      date={formatEventDate(event.date, event.timeZone, i18n.language)}
      venue={event.venue}
      coverUrl={event.coverUrl}
      guests={event.counts.people}
      rsvp={{ answered: event.counts.rsvpAnswered, total: event.counts.invitations }}
    />
  )
}
