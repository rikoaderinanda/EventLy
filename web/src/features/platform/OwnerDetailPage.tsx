import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { StatusBadge } from '@/features/events/StatusBadge'
import { formatMoney } from '@/features/payments/api'
import { PaymentStatusBadge } from '@/features/payments/PaymentStatusBadge'
import { Field } from '@/shared/components/Field'
import { errorMessage } from '@/shared/lib/errors'
import { useActivateManually, useAllPackages, useOwner, type PlatformEvent } from './api'

/** Root confirms a bank transfer (or other payment outside the gateway) and activates the event. */
function ManualActivation({ event, onDone }: { event: PlatformEvent; onDone: () => void }) {
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
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">{t('platform.activateHint')}</p>
      <div className="text-left text-sm">
        <label htmlFor={`pkg-${event.id}`} className="font-medium text-stone-700">
          {t('payments.package')}
        </label>
        <select
          id={`pkg-${event.id}`}
          required
          value={packageId}
          onChange={(e) => choose(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
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
        </select>
      </div>
      <Field
        id={`amount-${event.id}`}
        label={t('platform.amountReceived')}
        type="number"
        min={0}
        step={1}
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Field
        id={`note-${event.id}`}
        label={t('platform.paymentNote')}
        hint={t('platform.paymentNoteHint')}
        required
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {activate.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(t, activate.error)}
        </p>
      )}
      <button
        type="submit"
        disabled={activate.isPending}
        className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {t('platform.activate')}
      </button>
    </form>
  )
}

/** Root: one Owner with their events and purchases. No guests, invitations or photos (Q-24). */
export function OwnerDetailPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const { data, isPending, isError, error } = useOwner(id)
  const [activating, setActivating] = useState<string | null>(null)

  if (isPending) return <p className="py-8 text-stone-500">{t('common.loading')}</p>
  if (isError) return <p className="py-8 text-red-700">{errorMessage(t, error)}</p>

  const { owner, events, payments } = data
  return (
    <section className="mx-auto max-w-4xl space-y-6 py-8">
      <div>
        <Link to="/platform" className="text-sm text-brand-700 underline">
          ← {t('platform.ownersTitle')}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-brand-900">{owner.name}</h1>
        <p className="text-sm text-stone-500">
          {owner.email} · {owner.organization?.name ?? t('platform.noOrganization')}
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold text-brand-900">{t('platform.eventsTitle')}</h2>
        {events.length === 0 && <p className="text-sm text-stone-500">{t('platform.noEvents')}</p>}
        <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4">
          {events.map((ev) => {
            const canActivate = ev.status === 'Draft' || ev.status === 'PendingPayment'
            return (
              <li key={ev.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-800">{ev.name}</p>
                    <p className="text-sm text-stone-500">
                      {new Intl.DateTimeFormat(i18n.language, {
                        timeZone: ev.timeZone,
                        dateStyle: 'long',
                      }).format(new Date(ev.date))}
                      {ev.packageName && ` · ${ev.packageName}`}
                    </p>
                  </div>
                  <StatusBadge status={ev.status} />
                  {canActivate && activating !== ev.id && (
                    <button
                      type="button"
                      onClick={() => setActivating(ev.id)}
                      className="text-sm text-brand-700 underline"
                    >
                      {t('platform.activateManually')}
                    </button>
                  )}
                </div>
                {activating === ev.id && <ManualActivation event={ev} onDone={() => setActivating(null)} />}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold text-brand-900">{t('payments.history')}</h2>
        {payments.length === 0 && <p className="text-sm text-stone-500">{t('platform.noPayments')}</p>}
        <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-stone-800">
                  {p.eventName} · {p.packageName}
                </p>
                <p className="text-stone-500">
                  {formatMoney(p.amount, p.currency, i18n.language)} · {t(`payments.provider.${p.provider}`)}{' '}
                  · {new Date(p.paidAt ?? p.createdAt).toLocaleString(i18n.language)}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <PaymentStatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
