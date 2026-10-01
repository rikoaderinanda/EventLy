import { ArrowLeft, CircleCheck, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { Loading } from '@/components/ui/Spinner'
import { env } from '@/config/env'
import { errorMessage } from '@/shared/lib/errors'
import { formatMoney, useReceipt } from './api'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brand-100 py-3 text-sm last:border-0">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-brand-950">{value}</dd>
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

  if (isPending) return <Loading className="py-20" />
  if (isError) return <Notice tone="danger">{errorMessage(t, error)}</Notice>

  const eventDate = new Intl.DateTimeFormat(i18n.language, {
    timeZone: receipt.eventTimeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(receipt.eventDate))

  return (
    <section className="mx-auto max-w-xl space-y-5 py-6 sm:py-10 print:max-w-none print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <ButtonLink
          to={`/app/events/${receipt.eventId}`}
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          className="-ml-3"
        >
          {t('payments.backToEvent')}
        </ButtonLink>
        <Button icon={Printer} onClick={() => window.print()}>
          {t('payments.print')}
        </Button>
      </div>

      <article className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 bg-linear-to-br from-brand-50 to-gold-100/40 p-6 print:bg-none print:px-0">
          <div>
            <p className="flex items-center gap-2 font-semibold text-brand-800">
              <img src="/icon.svg" alt="" className="size-6 rounded-md" />
              {env.appName}
            </p>
            <h1 className="mt-3 text-section">{t('payments.receiptTitle')}</h1>
          </div>
          <Badge tone="success" icon={CircleCheck}>
            {t('payments.status.Paid')}
          </Badge>
        </header>
        <dl className="px-6 py-2 print:px-0">
          <Row label={t('payments.reference')} value={receipt.reference} />
          <Row label={t('payments.paidAt')} value={new Date(receipt.paidAt).toLocaleString(i18n.language)} />
          <Row label={t('payments.billedTo')} value={`${receipt.organizationName} · ${receipt.ownerName}`} />
          <Row label={t('auth.email')} value={receipt.organizationEmail ?? receipt.ownerEmail} />
          <Row label={t('payments.event')} value={`${receipt.eventName} · ${eventDate}`} />
          <Row label={t('payments.package')} value={receipt.packageName} />
          <Row label={t('payments.method')} value={t(`payments.provider.${receipt.provider}`)} />
        </dl>
        <div className="flex items-baseline justify-between gap-4 border-t border-brand-100 bg-brand-50/50 px-6 py-4 print:bg-none print:px-0">
          <span className="text-sm font-medium text-stone-600">{t('payments.total')}</span>
          <span className="text-2xl font-semibold text-brand-950 tabular-nums">
            {formatMoney(receipt.amount, receipt.currency, i18n.language)}
          </span>
        </div>
        <p className="px-6 pb-6 text-xs text-stone-500 print:px-0">{t('payments.receiptFootnote')}</p>
      </article>
    </section>
  )
}
