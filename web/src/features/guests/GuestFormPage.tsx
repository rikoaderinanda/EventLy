import {
  ArrowLeft,
  Download,
  Mail,
  Phone,
  RefreshCw,
  ShieldOff,
  Trash2,
  User,
  UsersRound,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { Card, PageHeader, SectionHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Spinner'
import { isEditable, useEvent, type EventDetail } from '@/features/events/api'
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

const typeIcons = { Individual: User, Group: UsersRound }

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
    <Card as="section">
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={readOnly} className="space-y-5">
          <TextField
            id="name"
            label={t('guests.name')}
            hint={t('guests.nameHint')}
            icon={User}
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="phone"
              label={t('guests.phone')}
              hint={t('guests.phoneHint')}
              icon={Phone}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
            />
            <TextField
              id="email"
              label={t('guests.email')}
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium text-stone-700">{t('guests.typeLabel')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['Individual', 'Group'] as const).map((type) => {
                const Icon = typeIcons[type]
                const selected = guestType === type
                return (
                  <label
                    key={type}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600',
                      selected
                        ? 'border-brand-500 bg-brand-50 font-medium text-brand-900'
                        : 'border-stone-200 text-stone-600 hover:border-brand-200',
                    )}
                  >
                    <input
                      type="radio"
                      name="guestType"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setGuestType(type)}
                    />
                    <Icon
                      aria-hidden
                      className={cn('size-5', selected ? 'text-brand-600' : 'text-stone-400')}
                    />
                    {t(`guests.type.${type}`)}
                  </label>
                )
              })}
            </div>
            {guestType === 'Group' && (
              <TextField
                id="people"
                label={t('guests.people')}
                hint={t('guests.peopleHint')}
                type="number"
                inputMode="numeric"
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
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-stone-700">{t('guests.sessions')}</legend>
              {event.sessions.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-brand-200"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-600"
                    checked={sessions.has(s.id)}
                    onChange={() => toggleSession(s.id)}
                  />
                  <span className="flex-1">{s.name}</span>
                  {s.isCheckInSession && <Badge tone="brand">{t('events.checkInSession')}</Badge>}
                </label>
              ))}
              {errors.sessionIds && <p className="text-xs text-danger-700">{errors.sessionIds}</p>}
            </fieldset>
          )}
        </fieldset>

        {save.isError && <Notice tone="danger">{errorMessage(t, save.error)}</Notice>}
        {!readOnly && (
          <Button
            type="submit"
            size="lg"
            block="mobile"
            loading={save.isPending}
            disabled={sessions.size === 0}
          >
            {guest ? t('common.save') : t('guests.addSubmit')}
          </Button>
        )}
      </form>
    </Card>
  )
}

/** Link, QR, WhatsApp, new code and revoke for one invitation. */
function InvitationPanel({ event, guest }: { event: EventDetail; guest: Guest }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const invitation = guest.invitation
  const active = invitation.status === 'Active'
  // No URL until the event is paid: the invitation is prepared but can't be sent yet (Q-48).
  const sendable = active && invitation.url !== null
  const qr = useQrImage(invitation.id, invitation.code, sendable)
  const action = useInvitationAction(event.id, invitation.id)
  const remove = useDeleteGuest(event.id, guest.id)
  const editable = isEditable(event.status)
  const error = action.error ?? remove.error

  return (
    <Card as="section" className="space-y-4">
      <SectionHeader
        title={t('guests.invitationTitle')}
        level={2}
        className="mb-0"
        actions={
          <Badge tone={active ? 'success' : 'neutral'}>{t(`guests.status.${invitation.status}`)}</Badge>
        }
      />
      {active && !sendable && <Notice>{t('guests.sendAfterPaymentHint')}</Notice>}
      {sendable && (
        <>
          {qr.data && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-brand-50 p-5">
              <img
                src={qr.data}
                alt={t('guests.qrAlt', { name: guest.name })}
                className="size-48 rounded-xl bg-white p-2 shadow-soft"
              />
              <a
                href={qr.data}
                download={`undangan-${guest.name}.png`}
                className={buttonClass({ variant: 'ghost', size: 'sm' })}
              >
                <Download aria-hidden />
                {t('guests.downloadQr')}
              </a>
            </div>
          )}
          <p className="rounded-xl bg-stone-50 px-3 py-2 font-mono text-xs break-all text-stone-600">
            {invitation.url}
          </p>
          <InvitationActions invitation={invitation} />
        </>
      )}
      {!active && <p className="text-sm text-stone-600">{t('guests.revokedHint')}</p>}

      {editable && (
        <div className="flex flex-wrap gap-2 border-t border-brand-100 pt-4">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() =>
              (active ? window.confirm(t('guests.confirmRegenerate')) : true) &&
              action.mutate('regenerate-code')
            }
          >
            {active ? t('guests.regenerate') : t('guests.restore')}
          </Button>
          {active && (
            <Button
              variant="danger"
              size="sm"
              icon={ShieldOff}
              onClick={() => window.confirm(t('guests.confirmRevoke')) && action.mutate('revoke')}
            >
              {t('guests.revoke')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
            onClick={() =>
              window.confirm(t('guests.confirmDelete', { name: guest.name })) &&
              remove.mutate(undefined, {
                onSuccess: () => void navigate(`/app/events/${event.id}/guests`, { replace: true }),
              })
            }
          >
            {t('guests.delete')}
          </Button>
        </div>
      )}
      {error && <Notice tone="danger">{errorMessage(t, error)}</Notice>}
    </Card>
  )
}

function Page({ event, guest }: { event: EventDetail; guest: Guest | null }) {
  const { t } = useTranslation()
  return (
    <section className={cn('mx-auto space-y-5 py-6 sm:py-10', guest ? 'max-w-5xl' : 'max-w-2xl')}>
      <ButtonLink
        to={`/app/events/${event.id}/guests`}
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        className="-ml-3"
      >
        {t('guests.title')}
      </ButtonLink>
      <PageHeader
        className="mb-0 sm:mb-0"
        eyebrow={event.name}
        title={
          guest ? (
            <span className="flex items-center gap-3">
              <Avatar name={guest.name} size="lg" />
              {guest.name}
            </span>
          ) : (
            t('guests.newTitle')
          )
        }
      />
      {guest ? (
        <div className="grid items-start gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <GuestForm key={guest.id} event={event} guest={guest} />
          </div>
          <div className="lg:sticky lg:top-24 lg:col-span-2">
            <InvitationPanel event={event} guest={guest} />
          </div>
        </div>
      ) : (
        <GuestForm key="new" event={event} guest={null} />
      )}
    </section>
  )
}

export function NewGuestPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  if (event.isPending) return <Loading className="py-20" />
  if (event.isError) return <Notice tone="danger">{errorMessage(t, event.error)}</Notice>
  return <Page event={event.data} guest={null} />
}

export function EditGuestPage() {
  const { t } = useTranslation()
  const { id = '', guestId = '' } = useParams()
  const event = useEvent(id)
  const guest = useGuest(id, guestId)
  if (event.isPending || guest.isPending) return <Loading className="py-20" />
  if (event.isError) return <Notice tone="danger">{errorMessage(t, event.error)}</Notice>
  if (guest.isError) return <Notice tone="danger">{errorMessage(t, guest.error)}</Notice>
  return <Page event={event.data} guest={guest.data} />
}
