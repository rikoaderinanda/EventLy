import { useTranslation } from 'react-i18next'
import type { PaymentStatus } from './api'

const style: Record<PaymentStatus, string> = {
  Pending: 'bg-amber-50 text-amber-800',
  Paid: 'bg-emerald-50 text-emerald-700',
  Failed: 'bg-red-50 text-red-700',
  Expired: 'bg-stone-100 text-stone-600',
  Cancelled: 'bg-stone-100 text-stone-600',
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style[status]}`}>
      {t(`payments.status.${status}`)}
    </span>
  )
}
