import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useEvent } from '@/features/events/api'
import type { RsvpStatus } from '@/features/invitation/api'
import { errorMessage } from '@/shared/lib/errors'
import { useRsvps, useRsvpSummary } from './api'
import { RsvpBadge } from './RsvpBadge'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-brand-100 bg-white p-3 text-center">
      <p className="text-2xl font-semibold text-brand-900 tabular-nums">{value}</p>
      <p className="text-xs text-stone-600">{label}</p>
    </div>
  )
}

/** Owner/Admin: who answered what, and how many people to expect. */
export function RsvpPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const [status, setStatus] = useState<RsvpStatus | ''>('')
  const summary = useRsvpSummary(id)
  const rows = useRsvps(id, status)

  return (
    <section className="mx-auto max-w-4xl space-y-4 py-8">
      <Link to={`/app/events/${id}`} className="text-sm text-brand-700 underline">
        ← {event.data?.name ?? t('events.title')}
      </Link>
      <h1 className="text-2xl font-semibold text-brand-900">{t('responses.rsvpTitle')}</h1>

      {summary.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t('responses.invitations')} value={summary.data.invitations} />
          <Stat label={t('responses.opened')} value={summary.data.opened} />
          <Stat label={t('responses.status.Attending')} value={summary.data.attending} />
          <Stat label={t('responses.status.NotAttending')} value={summary.data.notAttending} />
          <Stat label={t('responses.status.Pending')} value={summary.data.pending} />
          <Stat label={t('responses.expectedPeople')} value={summary.data.expectedPeople} />
        </div>
      )}

      <select
        aria-label={t('responses.filter')}
        value={status}
        onChange={(e) => setStatus(e.target.value as RsvpStatus | '')}
        className="rounded-md border border-stone-300 bg-white px-3 py-2"
      >
        <option value="">{t('responses.allAnswers')}</option>
        {(['Attending', 'NotAttending', 'Pending'] as const).map((s) => (
          <option key={s} value={s}>
            {t(`responses.status.${s}`)}
          </option>
        ))}
      </select>

      {(rows.isError || summary.isError) && (
        <p className="text-red-700">{errorMessage(t, rows.error ?? summary.error)}</p>
      )}
      <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4">
        {rows.data?.map((row) => (
          <li key={row.invitationId} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <Link
                to={`/app/events/${id}/guests/${row.guestId}`}
                className="font-medium text-brand-800 underline"
              >
                {row.guestName}
              </Link>
              <p className="text-sm text-stone-500">
                {row.guestType === 'Group'
                  ? t('guests.groupOf', { n: row.numberOfPeople })
                  : t('guests.type.Individual')}
                {' · '}
                {row.openedAt
                  ? t('responses.openedOn', {
                      date: new Date(row.openedAt).toLocaleDateString(i18n.language),
                    })
                  : t('responses.notOpened')}
                {row.invitationStatus === 'Revoked' && ` · ${t('guests.status.Revoked')}`}
              </p>
            </div>
            <RsvpBadge status={row.status} />
          </li>
        ))}
        {rows.data?.length === 0 && (
          <li className="py-6 text-center text-stone-500">{t('responses.empty')}</li>
        )}
      </ul>
    </section>
  )
}
