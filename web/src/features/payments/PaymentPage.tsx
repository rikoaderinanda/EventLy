import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { errorMessage } from '@/shared/lib/errors'
import { formatMoney, usePayment, useSimulatePayment, type Payment } from './api'
import { PaymentStatusBadge } from './PaymentStatusBadge'

/** Development only: the fake gateway's checkout. A real provider has its own page. */
function SimulatedCheckout({ payment }: { payment: Payment }) {
  const { t } = useTranslation()
  const simulate = useSimulatePayment(payment.id)
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4">
      <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">
        {t('payments.simulateTitle')}
      </p>
      <p className="text-sm text-amber-900">{t('payments.simulateHint')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={simulate.isPending}
          onClick={() => simulate.mutate('Paid')}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t('payments.simulatePaid')}
        </button>
        <button
          type="button"
          disabled={simulate.isPending}
          onClick={() => simulate.mutate('Failed')}
          className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
        >
          {t('payments.simulateFailed')}
        </button>
      </div>
      {simulate.isError && <p className="text-sm text-red-700">{errorMessage(t, simulate.error)}</p>}
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

  if (isPending) return <p className="py-8 text-stone-500">{t('common.loading')}</p>
  if (isError) return <p className="py-8 text-red-700">{errorMessage(t, error)}</p>

  return (
    <section className="mx-auto max-w-xl space-y-5 py-8">
      <Link to={`/app/events/${payment.eventId}`} className="text-sm text-brand-700 underline">
        ← {t('payments.backToEvent')}
      </Link>
      <div className="space-y-1 rounded-lg border border-brand-100 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-brand-900">{t('payments.title')}</h1>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="text-stone-700">{t('payments.packageLine', { name: payment.packageName })}</p>
        <p className="text-2xl font-semibold text-stone-900">
          {formatMoney(payment.amount, payment.currency, i18n.language)}
        </p>
        {payment.status === 'Pending' && payment.expiresAt && (
          <p className="text-sm text-stone-500">
            {t('payments.expiresAt', { date: new Date(payment.expiresAt).toLocaleString(i18n.language) })}
          </p>
        )}
      </div>

      <div role="status" aria-live="polite" className="text-sm">
        {payment.status === 'Pending' && <p className="text-stone-600">{t('payments.waiting')}</p>}
        {payment.status === 'Paid' && (
          <div className="space-y-2 rounded-lg bg-emerald-50 p-4 text-emerald-800">
            <p className="font-medium">{t('payments.paidMessage')}</p>
            <Link to={`/app/payments/${payment.id}/receipt`} className="underline">
              {t('payments.receipt')}
            </Link>
          </div>
        )}
        {(payment.status === 'Failed' || payment.status === 'Expired' || payment.status === 'Cancelled') && (
          <p className="rounded-lg bg-red-50 p-4 text-red-800">{t(`payments.closed.${payment.status}`)}</p>
        )}
      </div>

      {payment.status === 'Pending' && payment.provider === 'Fake' && <SimulatedCheckout payment={payment} />}
      {payment.status === 'Pending' && payment.provider !== 'Fake' && payment.checkoutUrl && (
        <a
          href={payment.checkoutUrl}
          className="inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white"
        >
          {t('payments.continue')}
        </a>
      )}
    </section>
  )
}
