import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { isEditable, useEvent, type EventDetail } from '@/features/events/api'
import { Field } from '@/shared/components/Field'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import {
  useDeleteGuest,
  useGuest,
  useInvitationAction,
  useQrImage,
  useSaveGuest,
  type Guest,
  type GuestType,
} from './api'
import { InvitationActions } from './InvitationActions'

function GuestForm({ event, guest }: { event: EventDetail; guest: Guest | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveGuest(event.id, guest?.id ?? null)
  const [name, setName] = useState(guest?.name ?? '')
  const [phone, setPhone] = useState(guest?.phone ?? '')
  const [email, setEmail] = useState(guest?.email ?? '')
  const [guestType, setGuestType] = useState<GuestType>(guest?.guestType ?? 'Individual')
  const [people, setPeople] = useState(String(guest?.numberOfPeople ?? 2))
  const [sessions, setSessions] = useState(new Set(guest?.sessionIds ?? event.sessions.map((s) => s.id)))
  const errors = fieldErrors(save.error)
  const readOnly = !isEditable(event.status)

  function toggleSession(id: string) {
    const next = new Set(sessions)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSessions(next)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      {
        name,
        phone: phone.trim() || null,
        email: email.trim() || null,
        guestType,
        numberOfPeople: guestType === 'Group' ? Number(people) : 1,
        sessionIds: [...sessions],
      },
      {
        onSuccess: (saved) => void navigate(`/app/events/${event.id}/guests/${saved.id}`, { replace: true }),
      },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-brand-100 bg-white p-5">
      <fieldset disabled={readOnly} className="space-y-4">
        <Field
          id="name"
          label={t('guests.name')}
          hint={t('guests.nameHint')}
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="phone"
            label={t('guests.phone')}
            hint={t('guests.phoneHint')}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
          <Field
            id="email"
            label={t('guests.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
        </div>

        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium text-stone-700">{t('guests.typeLabel')}</legend>
          <div className="flex flex-wrap gap-4">
            {(['Individual', 'Group'] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 text-stone-700">
                <input
                  type="radio"
                  name="guestType"
                  checked={guestType === type}
                  onChange={() => setGuestType(type)}
                />
                {t(`guests.type.${type}`)}
              </label>
            ))}
          </div>
          {guestType === 'Group' && (
            <Field
              id="people"
              label={t('guests.people')}
              hint={t('guests.peopleHint')}
              type="number"
              min={2}
              max={50}
              required
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              error={errors.numberOfPeople}
            />
          )}
        </fieldset>

        {event.sessions.length > 1 && (
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-stone-700">{t('guests.sessions')}</legend>
            {event.sessions.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-stone-700">
                <input type="checkbox" checked={sessions.has(s.id)} onChange={() => toggleSession(s.id)} />
                {s.name}
                {s.isCheckInSession && (
                  <span className="text-xs text-stone-500">({t('events.checkInSession')})</span>
                )}
              </label>
            ))}
            {errors.sessionIds && <p className="text-xs text-red-600">{errors.sessionIds}</p>}
          </fieldset>
        )}
      </fieldset>

      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(t, save.error)}
        </p>
      )}
      {!readOnly && (
        <button
          type="submit"
          disabled={save.isPending || sessions.size === 0}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {guest ? t('common.save') : t('guests.addSubmit')}
        </button>
      )}
    </form>
  )
}

/** Link, QR, WhatsApp, new code and revoke for one invitation. */
function InvitationPanel({ event, guest }: { event: EventDetail; guest: Guest }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const invitation = guest.invitation
  const active = invitation.status === 'Active'
  const qr = useQrImage(invitation.id, invitation.code, active)
  const action = useInvitationAction(event.id, invitation.id)
  const remove = useDeleteGuest(event.id, guest.id)
  const editable = isEditable(event.status)
  const error = action.error ?? remove.error

  return (
    <section className="space-y-4 rounded-lg border border-brand-100 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-brand-900">{t('guests.invitationTitle')}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}
        >
          {t(`guests.status.${invitation.status}`)}
        </span>
      </div>
      {active && (
        <>
          <p className="text-sm break-all text-stone-600">{invitation.url}</p>
          <InvitationActions invitation={invitation} />
          {qr.data && (
            <div className="flex flex-wrap items-end gap-3">
              <img
                src={qr.data}
                alt={t('guests.qrAlt', { name: guest.name })}
                className="size-48 border border-stone-200"
              />
              <a
                href={qr.data}
                download={`undangan-${guest.name}.png`}
                className="text-sm text-brand-700 underline"
              >
                {t('guests.downloadQr')}
              </a>
            </div>
          )}
        </>
      )}
      {!active && <p className="text-sm text-stone-600">{t('guests.revokedHint')}</p>}

      {editable && (
        <div className="flex flex-wrap gap-2 border-t border-brand-100 pt-4">
          <button
            type="button"
            onClick={() =>
              (active ? window.confirm(t('guests.confirmRegenerate')) : true) &&
              action.mutate('regenerate-code')
            }
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
          >
            {active ? t('guests.regenerate') : t('guests.restore')}
          </button>
          {active && (
            <button
              type="button"
              onClick={() => window.confirm(t('guests.confirmRevoke')) && action.mutate('revoke')}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700"
            >
              {t('guests.revoke')}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              window.confirm(t('guests.confirmDelete', { name: guest.name })) &&
              remove.mutate(undefined, {
                onSuccess: () => void navigate(`/app/events/${event.id}/guests`, { replace: true }),
              })
            }
            className="px-3 py-1.5 text-sm text-red-700 underline"
          >
            {t('guests.delete')}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(t, error)}
        </p>
      )}
    </section>
  )
}

function Page({ event, guest }: { event: EventDetail; guest: Guest | null }) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-2xl space-y-5 py-8">
      <Link to={`/app/events/${event.id}/guests`} className="text-sm text-brand-700 underline">
        ← {t('guests.title')}
      </Link>
      <h1 className="text-2xl font-semibold text-brand-900">{guest ? guest.name : t('guests.newTitle')}</h1>
      <GuestForm key={guest?.id ?? 'new'} event={event} guest={guest} />
      {guest && <InvitationPanel event={event} guest={guest} />}
    </section>
  )
}

export function NewGuestPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  if (event.isPending) return <p className="py-8 text-stone-500">{t('common.loading')}</p>
  if (event.isError) return <p className="py-8 text-red-700">{errorMessage(t, event.error)}</p>
  return <Page event={event.data} guest={null} />
}

export function EditGuestPage() {
  const { t } = useTranslation()
  const { id = '', guestId = '' } = useParams()
  const event = useEvent(id)
  const guest = useGuest(id, guestId)
  if (event.isPending || guest.isPending) return <p className="py-8 text-stone-500">{t('common.loading')}</p>
  if (event.isError) return <p className="py-8 text-red-700">{errorMessage(t, event.error)}</p>
  if (guest.isError) return <p className="py-8 text-red-700">{errorMessage(t, guest.error)}</p>
  return <Page event={event.data} guest={guest.data} />
}
