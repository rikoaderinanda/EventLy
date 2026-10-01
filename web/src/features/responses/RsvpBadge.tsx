import { useTranslation } from 'react-i18next'
import type { RsvpStatus } from '@/features/invitation/api'

const style: Record<RsvpStatus, string> = {
  Pending: 'bg-stone-100 text-stone-600',
  Attending: 'bg-emerald-50 text-emerald-700',
  NotAttending: 'bg-red-50 text-red-700',
}

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style[status]}`}>
      {t(`responses.status.${status}`)}
    </span>
  )
}
