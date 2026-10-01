import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { useSession } from '@/features/auth/session-store'
import { EventPaymentSection } from '@/features/payments/EventPaymentSection'
import { useUsers } from '@/features/users/api'
import { errorMessage } from '@/shared/lib/errors'
import {
  isEditable,
  useAssignStaff,
  useDeleteEvent,
  useEvent,
  useEventAction,
  useEventStaff,
  type EventDetail,
} from './api'
import { formatLocal, timeZoneLabel } from './format'
import { StatusBadge } from './StatusBadge'

function Sessions({ event }: { event: EventDetail }) {
  const { t, i18n } = useTranslation()
  const tz = timeZoneLabel[event.timeZone]
  return (
    <ul className="space-y-2">
      {event.sessions.map((s) => (
        <li key={s.id} className="rounded-lg border border-brand-100 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-stone-800">{s.name}</p>
            {s.isCheckInSession && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-900">
                {t('events.checkInSession')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-600">
            {formatLocal(s.startsAtLocal, i18n.language)} – {formatLocal(s.endsAtLocal, i18n.language, false)}{' '}
            {tz}
          </p>
          <p className="text-sm text-stone-600">{s.venue}</p>
          {s.mapsUrl && (
            <a
              href={s.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-brand-700 underline"
            >
              {t('events.openMaps')}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Owner only: pick which Staff members work at this event. */
function StaffAssignment({ event }: { event: EventDetail }) {
  const { t } = useTranslation()
  const members = useUsers()
  const assigned = useEventStaff(event.id, true)
  const save = useAssignStaff(event.id)
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const staff = (members.data ?? []).filter((u) => u.role === 'Staff' && u.status !== 'Disabled')
  const current = selected ?? new Set((assigned.data ?? []).map((s) => s.userId))

  function toggle(userId: string) {
    const next = new Set(current)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setSelected(next)
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-brand-900">{t('events.staffTitle')}</h2>
      {staff.length === 0 && members.isSuccess && (
        <p className="text-sm text-stone-500">
          {t('events.noStaff')}{' '}
          <Link to="/app/users" className="text-brand-700 underline">
            {t('nav.users')}
          </Link>
        </p>
      )}
      <ul className="space-y-1">
        {staff.map((u) => (
          <li key={u.id}>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={current.has(u.id)} onChange={() => toggle(u.id)} />
              {u.name} <span className="text-stone-400">({u.email})</span>
            </label>
          </li>
        ))}
      </ul>
      {save.isError && <p className="text-sm text-red-700">{errorMessage(t, save.error)}</p>}
      {staff.length > 0 && (
        <button
          type="button"
          disabled={save.isPending || selected === null}
          onClick={() => save.mutate([...current], { onSuccess: () => setSelected(null) })}
          className="rounded-md border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 disabled:opacity-50"
        >
          {t('events.saveStaff')}
        </button>
      )}
    </section>
  )
}

function Actions({ event }: { event: EventDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const role = useSession((s) => s.user?.role)
  const cancel = useEventAction(event.id, 'cancel')
  const complete = useEventAction(event.id, 'complete')
  const remove = useDeleteEvent(event.id)
  const error = cancel.error ?? complete.error ?? remove.error

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isEditable(event.status) && (
          <Link
            to={`/app/events/${event.id}/edit`}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white"
          >
            {t('events.edit')}
          </Link>
        )}
        {event.status === 'Active' && (
          <button
            type="button"
            onClick={() => complete.mutate()}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm"
          >
            {t('events.complete')}
          </button>
        )}
        {role === 'Owner' && isEditable(event.status) && (
          <button
            type="button"
            onClick={() => window.confirm(t('events.confirmCancel')) && cancel.mutate()}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700"
          >
            {t('events.cancel')}
          </button>
        )}
        {(event.status === 'Draft' || event.status === 'Cancelled') && (
          <button
            type="button"
            onClick={() =>
              window.confirm(t('events.confirmDelete')) &&
              remove.mutate(undefined, { onSuccess: () => navigate('/app', { replace: true }) })
            }
            className="rounded-md px-4 py-2 text-sm text-red-700 underline"
          >
            {t('events.delete')}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(t, error)}
        </p>
      )}
    </div>
  )
}

export function EventDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const role = useSession((s) => s.user?.role)
  const { data: event, isPending, isError, error } = useEvent(id)

  if (isPending) return <p className="py-8 text-stone-500">{t('common.loading')}</p>
  if (isError) return <p className="py-8 text-red-700">{errorMessage(t, error)}</p>

  return (
    <section className="mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <Link to="/app" className="text-sm text-brand-700 underline">
          ← {t('events.title')}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-brand-900">{event.name}</h1>
          <StatusBadge status={event.status} />
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {t(`events.category.${event.category}`)} · {timeZoneLabel[event.timeZone]}
        </p>
        {event.description && <p className="mt-3 whitespace-pre-line text-stone-700">{event.description}</p>}
      </div>

      <Actions event={event} />

      <nav aria-label={t('events.sectionsNav')} className="grid gap-3 sm:grid-cols-2">
        {[
          { to: 'guests', title: t('guests.title'), hint: t('guests.entryHint') },
          { to: 'rsvps', title: t('responses.rsvpTitle'), hint: t('responses.rsvpHint') },
          { to: 'wishes', title: t('responses.wishesTitle'), hint: t('responses.wishesEntry') },
          { to: 'gifts', title: t('responses.giftsTitle'), hint: t('responses.giftsEntry') },
          { to: 'check-ins', title: t('checkin.logTitle'), hint: t('checkin.logEntry') },
          { to: 'gallery', title: t('photos.galleryTitle'), hint: t('photos.galleryEntry') },
          { to: 'media', title: t('media.title'), hint: t('media.entry') },
        ].map((entry) => (
          <Link
            key={entry.to}
            to={`/app/events/${event.id}/${entry.to}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white p-4 hover:border-brand-300"
          >
            <span>
              <span className="block font-semibold text-brand-900">{entry.title}</span>
              <span className="text-sm text-stone-600">{entry.hint}</span>
            </span>
            <span aria-hidden="true" className="text-brand-700">
              →
            </span>
          </Link>
        ))}
      </nav>

      <div className="space-y-3">
        <h2 className="font-semibold text-brand-900">{t('events.sessions')}</h2>
        <Sessions event={event} />
      </div>

      {event.status !== 'Cancelled' && <EventPaymentSection event={event} />}

      {role === 'Owner' && <StaffAssignment event={event} />}
    </section>
  )
}
