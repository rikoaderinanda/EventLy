import { CalendarDays, Clock, MapPin, ScanLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoverPlaceholder } from '@/components/event/EventCard'
import { EventStatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice, ProgressBar } from '@/components/ui/Feedback'
import { Skeleton } from '@/components/ui/Spinner'
import { useSession } from '@/features/auth/session-store'
import { errorMessage } from '@/shared/lib/errors'
import { useEvents } from './api'
import { formatEventDate } from './format'

/** Staff home: the events they are assigned to; an active event opens the check-in scanner. */
export function StaffEventsPage() {
  const { t, i18n } = useTranslation()
  const name = useSession((s) => s.user?.name.split(/\s+/)[0] ?? '')
  const { data, isPending, isError, error } = useEvents()
  // Active events first: that is what staff look for when they arrive at the venue.
  const events =
    data && [...data].sort((a, b) => Number(b.status === 'Active') - Number(a.status === 'Active'))

  return (
    <section className="mx-auto max-w-xl py-6 sm:py-10">
      <PageHeader
        eyebrow={t('dashboard.greeting', { name })}
        title={t('staffArea.title')}
        subtitle={t('staffArea.subtitle')}
      />
      {isPending && <Skeleton className="h-64 rounded-3xl" />}
      {isError && <Notice tone="danger">{errorMessage(t, error)}</Notice>}
      {events?.length === 0 && (
        <Card>
          <EmptyState kind="events" title={t('staffArea.empty')} description={t('staffArea.emptyHint')} />
        </Card>
      )}
      <ul className="space-y-4">
        {events?.map((event) => (
          <li
            key={event.id}
            className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft"
          >
            <div className="relative h-28">
              {event.coverUrl ? (
                <img src={event.coverUrl} alt="" className="size-full object-cover" />
              ) : (
                <CoverPlaceholder category={event.category} className="relative size-full" />
              )}
              <span className="absolute top-3 right-3 rounded-full bg-white/90">
                <EventStatusBadge status={event.status} />
              </span>
            </div>
            <div className="space-y-3 p-5">
              <h2 className="text-card">{event.name}</h2>
              <ul className="space-y-1 text-sm text-stone-600">
                <li className="flex items-center gap-2">
                  <CalendarDays aria-hidden className="size-4 text-brand-500" />
                  {formatEventDate(event.date, event.timeZone, i18n.language)}
                </li>
                {event.venue && (
                  <li className="flex items-center gap-2">
                    <MapPin aria-hidden className="size-4 text-brand-500" />
                    {event.venue}
                  </li>
                )}
              </ul>
              {event.status === 'Active' && event.counts.people > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-500">
                    <span>{t('dashboard.checkedIn')}</span>
                    <span className="font-medium text-stone-700 tabular-nums">
                      {event.counts.checkedInPeople}/{event.counts.people}
                    </span>
                  </div>
                  <ProgressBar
                    value={event.counts.checkedInPeople}
                    max={event.counts.people}
                    label={t('dashboard.checkedIn')}
                  />
                </div>
              )}
              {event.status === 'Active' ? (
                <ButtonLink to={`/staff/events/${event.id}`} size="lg" block icon={ScanLine}>
                  {t('checkin.open')}
                </ButtonLink>
              ) : (
                <p className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-500">
                  <Clock aria-hidden className="size-4" />
                  {t('checkin.notActive')}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
