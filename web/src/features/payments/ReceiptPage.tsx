import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { env } from '@/config/env'
import { errorMessage } from '@/shared/lib/errors'
import { formatMoney, useReceipt } from './api'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-100 py-2 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-800">{value}</dd>
    </div>
  )
}

/**
 * Payment receipt (decision Q-36). The Owner prints it or saves it as PDF from the browser; the
 * print stylesheet hides the app chrome, so no PDF library is needed. Not a tax invoice.
 */
export function ReceiptPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const { data: receipt, isPending, isError, error } = useReceipt(id)

  if (isPending) return <p className="py-8 text-stone-500">{t('common.loading')}</p>
  if (isError) return <p className="py-8 text-red-700">{errorMessage(t, error)}</p>

  const eventDate = new Intl.DateTimeFormat(i18n.language, {
    timeZone: receipt.eventTimeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(receipt.eventDate))

  return (
    <section className="mx-auto max-w-xl space-y-4 py-8 print:max-w-none print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to={`/app/events/${receipt.eventId}`} className="text-sm text-brand-700 underline">
          ← {t('payments.backToEvent')}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white"
        >
          {t('payments.print')}
        </button>
      </div>

      <article className="rounded-lg border border-brand-100 bg-white p-6 print:border-0 print:p-0">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-brand-900">{env.appName}</p>
            <h1 className="text-2xl font-semibold text-stone-900">{t('payments.receiptTitle')}</h1>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            {t('payments.status.Paid')}
          </span>
        </header>
        <dl>
          <Row label={t('payments.reference')} value={receipt.reference} />
          <Row label={t('payments.paidAt')} value={new Date(receipt.paidAt).toLocaleString(i18n.language)} />
          <Row label={t('payments.billedTo')} value={`${receipt.organizationName} · ${receipt.ownerName}`} />
          <Row label={t('auth.email')} value={receipt.organizationEmail ?? receipt.ownerEmail} />
          <Row label={t('payments.event')} value={`${receipt.eventName} · ${eventDate}`} />
          <Row label={t('payments.package')} value={receipt.packageName} />
          <Row label={t('payments.method')} value={t(`payments.provider.${receipt.provider}`)} />
          <Row
            label={t('payments.total')}
            value={formatMoney(receipt.amount, receipt.currency, i18n.language)}
          />
        </dl>
        <p className="mt-4 text-xs text-stone-500">{t('payments.receiptFootnote')}</p>
      </article>
    </section>
  )
}
