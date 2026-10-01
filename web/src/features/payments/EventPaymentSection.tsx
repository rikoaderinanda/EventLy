import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useSession } from '@/features/auth/session-store'
import type { EventDetail } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import {
  formatMoney,
  isInternalCheckout,
  useEventPayments,
  usePackages,
  useStartCheckout,
  type Package,
  type PackageFeatures,
  type Payment,
} from './api'
import { PaymentStatusBadge } from './PaymentStatusBadge'

/** The limits an Owner compares when choosing, and sees on a paid event. */
export function FeatureList({ features }: { features: PackageFeatures }) {
  const { t, i18n } = useTranslation()
  const n = (value: number) => ({ n: value.toLocaleString(i18n.language) })
  const items = [
    t('packages.feature.guests', n(features.maxGuests)),
    t('packages.feature.photos', n(features.maxPhotos)),
    t('packages.feature.staff', n(features.maxStaff)),
    t('packages.feature.retention', n(features.galleryRetentionDays)),
    features.guestUploadEnabled
      ? t('packages.feature.guestPhotos', n(features.maxGuestPhotosPerInvitation))
      : null,
    features.zipDownload ? t('packages.feature.zip') : null,
    features.excelExport ? t('packages.feature.excel') : t('packages.feature.csvOnly'),
  ].filter((item): item is string => item !== null)

  return (
    <ul className="space-y-0.5 text-sm text-stone-600">
      {items.map((item) => (
        <li key={item}>· {item}</li>
      ))}
    </ul>
  )
}

function PackagePicker({ event, current }: { event: EventDetail; current: Payment | undefined }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const packages = usePackages()
  const checkout = useStartCheckout(event.id)
  const [selected, setSelected] = useState<string | null>(current?.packageId ?? null)

  function pay(pkg: Package) {
    checkout.mutate(pkg.id, {
      onSuccess: (payment) => {
        if (!payment.checkoutUrl) return
        if (isInternalCheckout(payment.checkoutUrl)) void navigate(payment.checkoutUrl)
        else window.location.assign(payment.checkoutUrl)
      },
    })
  }

  const chosen = packages.data?.find((p) => p.id === selected)
  return (
    <div className="space-y-3">
      {packages.isError && <p className="text-sm text-red-700">{errorMessage(t, packages.error)}</p>}
      <div role="radiogroup" aria-label={t('packages.choose')} className="grid gap-3 sm:grid-cols-3">
        {packages.data?.map((pkg) => (
          <label
            key={pkg.id}
            className={`cursor-pointer rounded-lg border bg-white p-4 ${selected === pkg.id ? 'border-brand-700 ring-2 ring-brand-200' : 'border-brand-100'}`}
          >
            <input
              type="radio"
              name="package"
              value={pkg.id}
              checked={selected === pkg.id}
              onChange={() => setSelected(pkg.id)}
              className="sr-only"
            />
            <span className="block font-semibold text-brand-900">{pkg.name}</span>
            <span className="mb-2 block text-lg font-medium text-stone-800">
              {formatMoney(pkg.price, pkg.currency, i18n.language)}
            </span>
            <FeatureList features={pkg.features} />
          </label>
        ))}
      </div>
      {checkout.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(t, checkout.error)}
        </p>
      )}
      <button
        type="button"
        disabled={!chosen || checkout.isPending}
        onClick={() => chosen && pay(chosen)}
        className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {chosen
          ? t('packages.payFor', {
              name: chosen.name,
              price: formatMoney(chosen.price, chosen.currency, i18n.language),
            })
          : t('packages.choose')}
      </button>
    </div>
  )
}

function PaymentHistory({ payments }: { payments: Payment[] }) {
  const { t, i18n } = useTranslation()
  if (payments.length === 0) return null
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-stone-600">{t('payments.history')}</summary>
      <ul className="mt-2 divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-3">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="flex-1 text-stone-700">
              {p.packageName} · {formatMoney(p.amount, p.currency, i18n.language)} ·{' '}
              {new Date(p.createdAt).toLocaleString(i18n.language)}
            </span>
            <PaymentStatusBadge status={p.status} />
            {p.status === 'Paid' && (
              <Link to={`/app/payments/${p.id}/receipt`} className="text-brand-700 underline">
                {t('payments.receipt')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * Package and payment of an event. The Owner chooses a package and pays (Draft), continues an open
 * checkout (PendingPayment) and gets the receipt (paid). Admin only sees which package the event has.
 */
export function EventPaymentSection({ event }: { event: EventDetail }) {
  const { t } = useTranslation()
  const isOwner = useSession((s) => s.user?.role) === 'Owner'
  const payments = useEventPayments(event.id, isOwner)
  const pending = payments.data?.find((p) => p.status === 'Pending')
  const paid = payments.data?.find((p) => p.status === 'Paid')
  const payable = event.status === 'Draft' || event.status === 'PendingPayment'

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-brand-900">{t('packages.sectionTitle')}</h2>

      {event.package && (
        <div className="rounded-lg border border-brand-100 bg-white p-4">
          <p className="mb-1 font-medium text-stone-800">
            {t('packages.current', { name: event.package.name })}
          </p>
          <FeatureList features={event.package.features} />
          {isOwner && paid && (
            <Link
              to={`/app/payments/${paid.id}/receipt`}
              className="mt-2 inline-block text-sm text-brand-700 underline"
            >
              {t('payments.receipt')}
            </Link>
          )}
        </div>
      )}

      {payable && !isOwner && <p className="text-sm text-stone-600">{t('packages.ownerPays')}</p>}

      {payable && isOwner && (
        <>
          {pending && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>{t('payments.pendingNotice', { name: pending.packageName })}</p>
              <Link to={`/app/payments/${pending.id}`} className="font-medium underline">
                {t('payments.continue')}
              </Link>
            </div>
          )}
          <p className="text-sm text-stone-600">
            {t(pending ? 'packages.changeHint' : 'packages.chooseHint')}
          </p>
          <PackagePicker key={pending?.id ?? 'none'} event={event} current={pending} />
        </>
      )}

      {isOwner && <PaymentHistory payments={payments.data ?? []} />}
    </section>
  )
}
