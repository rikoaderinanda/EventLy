import { CalendarPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Feedback'
import { Skeleton } from '@/components/ui/Spinner'
import { errorMessage } from '@/shared/lib/errors'
import { type EventListItem, type EventStatus, useEvents } from './api'
import { EventListCard } from './EventListCard'

type Filter = 'all' | 'upcoming' | 'draft' | 'past'

const filters: Record<Filter, (e: EventListItem) => boolean> = {
  all: () => true,
  upcoming: (e) => e.status === 'Active',
  draft: (e) => (['Draft', 'PendingPayment'] as EventStatus[]).includes(e.status),
  past: (e) => e.status === 'Completed' || e.status === 'Cancelled',
}

/** The organization's events as cards, filtered by stage. */
export function EventListPage() {
  const { t } = useTranslation()
  const { data, isPending, isError, error } = useEvents()
  const [filter, setFilter] = useState<Filter>('all')
  const events = data ?? []
  const shown = events.filter(filters[filter])

  return (
    <section className="mx-auto max-w-6xl py-6 sm:py-10">
      <PageHeader
        title={t('events.title')}
        subtitle={t('events.listSubtitle')}
        actions={
          <ButtonLink to="/app/events/new" icon={CalendarPlus} block="mobile">
            {t('events.create')}
          </ButtonLink>
        }
      />

      {events.length > 0 && (
        <div
          role="group"
          aria-label={t('events.filterLabel')}
          className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {(Object.keys(filters) as Filter[]).map((key) => {
            const count = events.filter(filters[key]).length
            const current = key === filter
            return (
              <button
                key={key}
                type="button"
                aria-pressed={current}
                onClick={() => setFilter(key)}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                  current
                    ? 'bg-brand-900 text-white'
                    : 'bg-white text-stone-600 ring-1 ring-brand-100 hover:ring-brand-200',
                )}
              >
                {t(`events.filter.${key}`)}
                <span className={cn('text-xs tabular-nums', current ? 'text-white/70' : 'text-stone-400')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      )}
      {isError && <Notice tone="danger">{errorMessage(t, error)}</Notice>}

      {data && events.length === 0 && (
        <Card>
          <EmptyState
            kind="events"
            title={t('events.emptyTitle')}
            description={t('events.emptyBody')}
            action={
              <ButtonLink to="/app/events/new" icon={CalendarPlus}>
                {t('events.create')}
              </ButtonLink>
            }
          />
        </Card>
      )}
      {events.length > 0 && shown.length === 0 && (
        <EmptyState kind="events" title={t('events.filterEmpty')} />
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((event) => (
          <li key={event.id}>
            <EventListCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  )
}
