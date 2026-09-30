import { useTranslation } from 'react-i18next'
import type { EventStatus } from './api'

const style: Record<EventStatus, string> = {
  Draft: 'bg-stone-100 text-stone-700',
  PendingPayment: 'bg-amber-50 text-amber-800',
  Active: 'bg-emerald-50 text-emerald-700',
  Completed: 'bg-sky-50 text-sky-700',
  Cancelled: 'bg-red-50 text-red-700',
}

export function StatusBadge({ status }: { status: EventStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style[status]}`}>
      {t(`events.status.${status}`)}
    </span>
  )
}
