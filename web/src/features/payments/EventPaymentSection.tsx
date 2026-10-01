import { Check, CreditCard, ReceiptText, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Badge, PaymentBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Feedback'
import { ToolPanel } from '@/components/ui/ToolPanel'
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
    <ul className="space-y-1.5 text-sm text-stone-600">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-500" />
          {item}
        </li>
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
    <div className="space-y-4">
      {packages.isError && <Notice tone="danger">{errorMessage(t, packages.error)}</Notice>}
      <div role="radiogroup" aria-label={t('packages.choose')} className="grid gap-3 md:grid-cols-3">
        {packages.data?.map((pkg) => {
          const isSelected = selected === pkg.id
          return (
            <label
              key={pkg.id}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-2xl border bg-white p-5 transition-[border-color,box-shadow] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600',
                isSelected
                  ? 'border-brand-500 shadow-lift ring-2 ring-brand-200'
                  : 'border-brand-100 hover:border-brand-200',
              )}
            >
              <input
                type="radio"
                name="package"
                value={pkg.id}
                checked={isSelected}
                onChange={() => setSelected(pkg.id)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-brand-950">{pkg.name}</span>
                {isSelected && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check aria-hidden className="size-4" />
                  </span>
                )}
              </span>
              <span className="mt-1 mb-4 block text-2xl font-semibold tracking-tight text-brand-950">
                {formatMoney(pkg.price, pkg.currency, i18n.language)}
              </span>
              <FeatureList features={pkg.features} />
            </label>
          )
        })}
      </div>
      {checkout.isError && <Notice tone="danger">{errorMessage(t, checkout.error)}</Notice>}
      <Button
        size="lg"
        block="mobile"
        icon={CreditCard}
        disabled={!chosen}
        loading={checkout.isPending}
        onClick={() => chosen && pay(chosen)}
      >
        {chosen
          ? t('packages.payFor', {
              name: chosen.name,
              price: formatMoney(chosen.price, chosen.currency, i18n.language),
            })
          : t('packages.choose')}
      </Button>
    </div>
  )
}

function PaymentHistory({ payments }: { payments: Payment[] }) {
  const { t, i18n } = useTranslation()
  if (payments.length === 0) return null
  return (
    <ToolPanel title={t('payments.history')} icon={ReceiptText}>
      <ul className="-my-2 divide-y divide-brand-100">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-brand-950">
                {p.packageName} · {formatMoney(p.amount, p.currency, i18n.language)}
              </span>
              <span className="block text-xs text-stone-500">
                {new Date(p.createdAt).toLocaleString(i18n.language)}
              </span>
            </span>
            <PaymentBadge status={p.status} />
            {p.status === 'Paid' && (
              <Link
                to={`/app/payments/${p.id}/receipt`}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                {t('payments.receipt')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </ToolPanel>
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
    <section className="space-y-4">
      <SectionHeader title={t('packages.sectionTitle')} level={2} className="mb-0" />

      {event.package && (
        <div className="rounded-2xl bg-linear-to-br from-brand-50 to-gold-100/50 p-5 ring-1 ring-brand-100">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="gold" icon={Sparkles}>
              {event.package.name}
            </Badge>
            <p className="font-medium text-brand-950">
              {t('packages.current', { name: event.package.name })}
            </p>
          </div>
          <FeatureList features={event.package.features} />
          {isOwner && paid && (
            <ButtonLink
              to={`/app/payments/${paid.id}/receipt`}
              variant="secondary"
              size="sm"
              icon={ReceiptText}
              className="mt-4"
            >
              {t('payments.receipt')}
            </ButtonLink>
          )}
        </div>
      )}

      {payable && !isOwner && <Notice>{t('packages.ownerPays')}</Notice>}

      {payable && isOwner && (
        <>
          {pending && (
            <Notice
              tone="warning"
              action={
                <ButtonLink to={`/app/payments/${pending.id}`} size="sm">
                  {t('payments.continue')}
                </ButtonLink>
              }
            >
              {t('payments.pendingNotice', { name: pending.packageName })}
            </Notice>
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
