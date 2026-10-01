import { ArrowLeft, BadgeCheck, Building2, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { EventStatusBadge, PaymentBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Select, TextField } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Spinner'
import { formatMoney } from '@/features/payments/api'
import { errorMessage } from '@/shared/lib/errors'
import { useActivateManually, useAllPackages, useOwner, type PlatformEvent } from './api'

/** Root confirms a bank transfer (or other payment outside the gateway) and activates the event. */
function ManualActivation({
  event,
  onDone,
  onCancel,
}: {
  event: PlatformEvent
  onDone: () => void
  onCancel: () => void
}) {
  const { t, i18n } = useTranslation()
  const packages = useAllPackages()
  const activate = useActivateManually()
  const [packageId, setPackageId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  function choose(id: string) {
    setPackageId(id)
    const pkg = packages.data?.find((p) => p.id === id)
    if (pkg) setAmount(String(pkg.price))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    activate.mutate({ eventId: event.id, packageId, amount: Number(amount), note }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-sm text-stone-600">{t('platform.activateHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          id={`pkg-${event.id}`}
          label={t('payments.package')}
          required
          value={packageId}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="" disabled>
            {t('packages.choose')}
          </option>
          {packages.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatMoney(p.price, p.currency, i18n.language)}
              {p.isActive ? '' : ` (${t('platform.inactive')})`}
            </option>
          ))}
        </Select>
        <TextField
          id={`amount-${event.id}`}
          label={t('platform.amountReceived')}
          type="number"
          min={0}
          step={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <TextField
        id={`note-${event.id}`}
        label={t('platform.paymentNote')}
        hint={t('platform.paymentNoteHint')}
        required
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {activate.isError && <Notice tone="danger">{errorMessage(t, activate.error)}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" icon={BadgeCheck} loading={activate.isPending}>
          {t('platform.activate')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('checkin.cancel')}
        </Button>
      </div>
    </form>
  )
}

/** Root: one Owner with their events and purchases. No guests, invitations or photos (Q-24). */
export function OwnerDetailPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const { data, isPending, isError, error } = useOwner(id)
  const [activating, setActivating] = useState<string | null>(null)

  if (isPending) return <Loading className="py-20" />
  if (isError) return <Notice tone="danger">{errorMessage(t, error)}</Notice>

  const { owner, events, payments } = data
  return (
    <section className="mx-auto max-w-5xl space-y-8 py-6 sm:py-10">
      <ButtonLink to="/platform" variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3">
        {t('platform.ownersTitle')}
      </ButtonLink>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={owner.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-section">{owner.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <Mail aria-hidden className="size-4" />
              {owner.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 aria-hidden className="size-4" />
              {owner.organization?.name ?? t('platform.noOrganization')}
            </span>
          </p>
        </div>
      </header>

      <section>
        <SectionHeader title={t('platform.eventsTitle')} level={2} />
        {events.length === 0 && <p className="text-sm text-stone-500">{t('platform.noEvents')}</p>}
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white empty:hidden">
          {events.map((ev) => {
            const canActivate = ev.status === 'Draft' || ev.status === 'PendingPayment'
            return (
              <li key={ev.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-900">{ev.name}</p>
                    <p className="text-sm text-stone-500">
                      {new Intl.DateTimeFormat(i18n.language, {
                        timeZone: ev.timeZone,
                        dateStyle: 'long',
                      }).format(new Date(ev.date))}
                      {ev.packageName && ` · ${ev.packageName}`}
                    </p>
                  </div>
                  <EventStatusBadge status={ev.status} />
                  {canActivate && activating !== ev.id && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={BadgeCheck}
                      onClick={() => setActivating(ev.id)}
                    >
                      {t('platform.activateManually')}
                    </Button>
                  )}
                </div>
                {activating === ev.id && (
                  <ManualActivation
                    event={ev}
                    onDone={() => setActivating(null)}
                    onCancel={() => setActivating(null)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <SectionHeader title={t('payments.history')} level={2} />
        {payments.length === 0 && <p className="text-sm text-stone-500">{t('platform.noPayments')}</p>}
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white empty:hidden">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">
                  {p.eventName} · {p.packageName}
                </p>
                <p className="text-stone-500">
                  <span className="font-medium text-stone-700 tabular-nums">
                    {formatMoney(p.amount, p.currency, i18n.language)}
                  </span>{' '}
                  · {t(`payments.provider.${p.provider}`)} ·{' '}
                  {new Date(p.paidAt ?? p.createdAt).toLocaleString(i18n.language)}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <PaymentBadge status={p.status} />
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
