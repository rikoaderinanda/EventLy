import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  ExternalLink,
  FlaskConical,
  Hourglass,
  ReceiptText,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { PaymentBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Loading, Spinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/shared/lib/errors'
import { formatMoney, usePayment, useSimulatePayment, type Payment } from './api'

/** Development only: the fake gateway's checkout. A real provider has its own page. */
function SimulatedCheckout({ payment }: { payment: Payment }) {
  const { t } = useTranslation()
  const simulate = useSimulatePayment(payment.id)
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-warning-500/60 bg-warning-50 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-warning-700 uppercase">
        <FlaskConical aria-hidden className="size-4" />
        {t('payments.simulateTitle')}
      </p>
      <p className="text-sm text-warning-700">{t('payments.simulateHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          icon={CircleCheck}
          loading={simulate.isPending}
          onClick={() => simulate.mutate('Paid')}
        >
          {t('payments.simulatePaid')}
        </Button>
        <Button
          variant="danger"
          icon={CircleX}
          disabled={simulate.isPending}
          onClick={() => simulate.mutate('Failed')}
        >
          {t('payments.simulateFailed')}
        </Button>
      </div>
      {simulate.isError && <Notice tone="danger">{errorMessage(t, simulate.error)}</Notice>}
    </div>
  )
}

/**
 * Where the Owner lands after checkout. Polls while the payment is pending, so the result of the
 * webhook shows up by itself.
 */
export function PaymentPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const { data: payment, isPending, isError, error } = usePayment(id)

  if (isPending) return <Loading className="py-20" />
  if (isError) return <Notice tone="danger">{errorMessage(t, error)}</Notice>

  return (
    <section className="mx-auto max-w-xl space-y-5 py-6 sm:py-10">
      <ButtonLink
        to={`/app/events/${payment.eventId}`}
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        className="-ml-3"
      >
        {t('payments.backToEvent')}
      </ButtonLink>
      <Card className="text-center">
        <div className="flex justify-center">
          <PaymentBadge status={payment.status} />
        </div>
        <h1 className="mt-3 text-section">{t('payments.title')}</h1>
        <p className="mt-1 text-stone-600">{t('payments.packageLine', { name: payment.packageName })}</p>
        <p className="mt-4 text-4xl font-semibold tracking-tight text-brand-950 tabular-nums">
          {formatMoney(payment.amount, payment.currency, i18n.language)}
        </p>
        {payment.status === 'Pending' && payment.expiresAt && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-stone-500">
            <Hourglass aria-hidden className="size-4" />
            {t('payments.expiresAt', { date: new Date(payment.expiresAt).toLocaleString(i18n.language) })}
          </p>
        )}
      </Card>

      <div role="status" aria-live="polite">
        {payment.status === 'Pending' && (
          <p className="flex items-center justify-center gap-2 text-sm text-stone-600">
            <Spinner className="text-brand-500" />
            {t('payments.waiting')}
          </p>
        )}
        {payment.status === 'Paid' && (
          <Notice
            tone="success"
            title={t('payments.paidMessage')}
            action={
              <ButtonLink
                to={`/app/payments/${payment.id}/receipt`}
                variant="secondary"
                size="sm"
                icon={ReceiptText}
              >
                {t('payments.receipt')}
              </ButtonLink>
            }
          />
        )}
        {(payment.status === 'Failed' || payment.status === 'Expired' || payment.status === 'Cancelled') && (
          <Notice tone="danger">{t(`payments.closed.${payment.status}`)}</Notice>
        )}
      </div>

      {payment.status === 'Pending' && payment.provider === 'Fake' && <SimulatedCheckout payment={payment} />}
      {payment.status === 'Pending' && payment.provider !== 'Fake' && payment.checkoutUrl && (
        <a href={payment.checkoutUrl} className={buttonClass({ size: 'lg', block: true })}>
          {t('payments.continue')}
          <ExternalLink aria-hidden />
        </a>
      )}
    </section>
  )
}
