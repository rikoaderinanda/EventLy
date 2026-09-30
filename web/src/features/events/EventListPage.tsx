import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { errorMessage } from '@/shared/lib/errors'
import { useEvents } from './api'
import { formatEventDate } from './format'
import { StatusBadge } from './StatusBadge'

/** Organizer home: the organization's events. */
export function EventListPage() {
  const { t, i18n } = useTranslation()
  const { data, isPending, isError, error } = useEvents()

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand-900">{t('events.title')}</h1>
        <Link to="/app/events/new" className="rounded-md bg-brand-700 px-4 py-2 font-medium text-white">
          {t('events.create')}
        </Link>
      </div>

      {isPending && <p className="text-stone-500">{t('common.loading')}</p>}
      {isError && <p className="text-red-700">{errorMessage(t, error)}</p>}
      {data?.length === 0 && (
        <div className="rounded-lg border border-dashed border-brand-300 bg-white p-8 text-center">
          <p className="font-medium text-brand-900">{t('events.emptyTitle')}</p>
          <p className="mt-1 text-sm text-stone-500">{t('events.emptyBody')}</p>
        </div>
      )}

      <ul className="space-y-2">
        {data?.map((event) => (
          <li key={event.id}>
            <Link
              to={`/app/events/${event.id}`}
              className="block rounded-lg border border-brand-100 bg-white p-4 hover:border-brand-300"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-stone-800">{event.name}</p>
                <StatusBadge status={event.status} />
              </div>
              <p className="mt-1 text-sm text-stone-500">
                {t(`events.category.${event.category}`)} ·{' '}
                {formatEventDate(event.date, event.timeZone, i18n.language)}
              </p>
              <p className="text-sm text-stone-500">{event.venue}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
