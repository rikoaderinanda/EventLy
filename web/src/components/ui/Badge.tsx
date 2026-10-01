import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  Clock,
  FilePen,
  Flag,
  Hourglass,
  type LucideIcon,
  ScanLine,
  Sparkles,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'

export type BadgeTone = 'neutral' | 'brand' | 'gold' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
  brand: 'bg-brand-100 text-brand-800 ring-brand-200',
  gold: 'bg-gold-100 text-gold-700 ring-gold-300/60',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  info: 'bg-sky-50 text-sky-800 ring-sky-100',
}

/**
 * Small status pill. Status is never shown by colour alone: there is always a word, and the status
 * badges below add an icon.
 */
export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  )
}

type StatusStyle = { tone: BadgeTone; icon: LucideIcon }

const eventStatus: Record<string, StatusStyle> = {
  Draft: { tone: 'neutral', icon: FilePen },
  PendingPayment: { tone: 'warning', icon: Hourglass },
  Active: { tone: 'success', icon: Sparkles },
  Completed: { tone: 'brand', icon: Flag },
  Cancelled: { tone: 'danger', icon: CircleSlash },
}

const rsvpStatus: Record<string, StatusStyle> = {
  Pending: { tone: 'neutral', icon: CircleDashed },
  Attending: { tone: 'success', icon: CircleCheck },
  NotAttending: { tone: 'danger', icon: CircleX },
}

const paymentStatus: Record<string, StatusStyle> = {
  Pending: { tone: 'warning', icon: Clock },
  Paid: { tone: 'success', icon: CircleCheck },
  Failed: { tone: 'danger', icon: CircleX },
  Expired: { tone: 'neutral', icon: Hourglass },
  Cancelled: { tone: 'neutral', icon: CircleSlash },
}

const fallback: StatusStyle = { tone: 'neutral', icon: CircleDashed }

export function EventStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const style = eventStatus[status] ?? fallback
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {t(`events.status.${status}`)}
    </Badge>
  )
}

export function RsvpBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const style = rsvpStatus[status] ?? fallback
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {t(`responses.status.${status}`)}
    </Badge>
  )
}

export function PaymentBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const style = paymentStatus[status] ?? fallback
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {t(`payments.status.${status}`)}
    </Badge>
  )
}

/** Checked in (with the time when known) or not yet. */
export function CheckInBadge({ checkedInAt }: { checkedInAt: string | null | undefined }) {
  const { t, i18n } = useTranslation()
  if (!checkedInAt)
    return (
      <Badge tone="neutral" icon={CircleDashed}>
        {t('ui.checkIn.no')}
      </Badge>
    )
  const time = new Date(checkedInAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  return (
    <Badge tone="success" icon={ScanLine}>
      {t('ui.checkIn.at', { time })}
    </Badge>
  )
}
