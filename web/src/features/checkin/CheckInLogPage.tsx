import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useEvent } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import { useCheckInLog, useCheckInSummary } from './api'

/** Owner/Admin: arrivals so far and who checked whom in. Refreshes by itself during the event. */
export function CheckInLogPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const summary = useCheckInSummary(id)
  const log = useCheckInLog(id)

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-8">
      <Link to={`/app/events/${id}`} className="text-sm text-brand-700 underline">
        ← {event.data?.name ?? t('events.title')}
      </Link>
      <h1 className="text-2xl font-semibold text-brand-900">{t('checkin.logTitle')}</h1>
      {summary.data && (
        <p className="text-stone-700">
          {t('checkin.counter', {
            arrived: summary.data.checkedInPeople,
            total: summary.data.people,
            invitations: summary.data.checkedInInvitations,
            allInvitations: summary.data.invitations,
          })}
        </p>
      )}
      {(log.isError || summary.isError) && (
        <p className="text-red-700">{errorMessage(t, log.error ?? summary.error)}</p>
      )}
      {log.data?.length === 0 && <p className="text-stone-500">{t('checkin.noCheckIns')}</p>}
      <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4 empty:hidden">
        {log.data?.map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
            <span className="font-medium text-stone-800">
              {item.guestName} <span className="font-normal text-stone-500">({item.numberOfPeople})</span>
            </span>
            <span className="text-stone-500">
              {new Date(item.checkedInAt).toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · {item.staffName} · {t(`checkin.method.${item.method}`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
