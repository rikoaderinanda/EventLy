import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const notice: Record<NoticeTone, { box: string; icon: LucideIcon }> = {
  info: { box: 'border-brand-200 bg-brand-100/60 text-brand-950', icon: Info },
  success: { box: 'border-success-100 bg-success-50 text-success-700', icon: CircleCheck },
  warning: { box: 'border-warning-100 bg-warning-50 text-warning-700', icon: TriangleAlert },
  danger: { box: 'border-danger-100 bg-danger-50 text-danger-700', icon: CircleAlert },
}

/**
 * An inline message box. Errors are announced (role="alert"), the others politely (role="status").
 */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: NoticeTone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const { box, icon: Icon } = notice[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', box, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-[1.125rem] shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title != null && 'mt-0.5', 'leading-relaxed')}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  )
}

/** Circular progress (RSVP answered, guests checked in). The value is also given as text for screen readers. */
export function ProgressRing({
  value,
  max,
  size = 64,
  stroke = 7,
  label,
  children,
  tone = 'brand',
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  /** Accessible name, e.g. "RSVP terjawab". */
  label: string
  children?: ReactNode
  tone?: 'brand' | 'success' | 'gold'
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const colour = { brand: 'stroke-brand-600', success: 'stroke-success-500', gold: 'stroke-gold-500' }[tone]
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          className="stroke-brand-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={cn(colour, 'transition-[stroke-dashoffset] duration-700 ease-out-soft')}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-brand-950">
        {children ?? `${Math.round(ratio * 100)}%`}
      </span>
    </div>
  )
}

/** Thin horizontal progress bar. */
export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number
  max: number
  label: string
  className?: string
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 overflow-hidden rounded-full bg-brand-100', className)}
    >
      <div
        className="h-full rounded-full bg-primary-gradient transition-[width] duration-700 ease-out-soft"
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}

/**
 * Tiny bar chart (for example check-ins per hour). Decorative: the card next to it states the number,
 * so it is hidden from screen readers.
 */
export function MiniBars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values)
  return (
    <div aria-hidden className={cn('flex h-10 items-end gap-1', className)}>
      {values.map((value, index) => (
        <span
          key={index}
          className="w-full min-w-1 rounded-t-sm bg-brand-300 last:bg-brand-600"
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}
