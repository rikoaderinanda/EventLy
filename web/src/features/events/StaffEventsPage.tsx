import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { errorMessage } from '@/shared/lib/errors'
import { useEvents } from './api'
import { formatEventDate } from './format'
import { StatusBadge } from './StatusBadge'

/** Staff home: the events they are assigned to; an active event opens the check-in scanner. */
export function StaffEventsPage() {
  const { t, i18n } = useTranslation()
  const { data, isPending, isError, error } = useEvents()

  return (
    <section className="mx-auto max-w-xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold text-brand-900">{t('staffArea.title')}</h1>
      {isPending && <p className="text-stone-500">{t('common.loading')}</p>}
      {isError && <p className="text-red-700">{errorMessage(t, error)}</p>}
      {data?.length === 0 && <p className="text-stone-500">{t('staffArea.empty')}</p>}
      <ul className="space-y-2">
        {data?.map((event) => (
          <li key={event.id} className="rounded-lg border border-brand-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-medium text-stone-800">{event.name}</p>
              <StatusBadge status={event.status} />
            </div>
            <p className="mt-1 text-sm text-stone-600">
              {formatEventDate(event.date, event.timeZone, i18n.language)}
            </p>
            <p className="text-sm text-stone-600">{event.venue}</p>
            {event.status === 'Active' ? (
              <Link
                to={`/staff/events/${event.id}`}
                className="mt-3 block rounded-lg bg-brand-700 py-3 text-center font-semibold text-white"
              >
                {t('checkin.open')}
              </Link>
            ) : (
              <p className="mt-3 text-xs text-stone-500">{t('checkin.notActive')}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
