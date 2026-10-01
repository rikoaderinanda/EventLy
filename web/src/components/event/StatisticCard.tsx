import { type LucideIcon, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

/**
 * One number on the dashboard: icon, label, value, and optionally a trend line or a visual
 * (a progress ring or a mini chart) on the right.
 */
export function StatisticCard({
  icon: Icon,
  label,
  value,
  caption,
  trend,
  visual,
  tone = 'brand',
  className,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  /** Small text under the value, e.g. "dari 250 orang". */
  caption?: ReactNode
  /** Change versus a previous period, e.g. { value: '+12 hari ini', up: true }. */
  trend?: { value: string; up: boolean }
  visual?: ReactNode
  tone?: 'brand' | 'success' | 'gold' | 'info'
  className?: string
}) {
  const iconTone = {
    brand: 'bg-brand-100 text-brand-700',
    success: 'bg-success-50 text-success-700',
    gold: 'bg-gold-100 text-gold-700',
    info: 'bg-sky-50 text-sky-800',
  }[tone]
  const Trend = trend?.up ? TrendingUp : TrendingDown
  return (
    <div className={cn('rounded-2xl border border-brand-100 bg-white p-4 shadow-soft sm:p-5', className)}>
      {/* The label gets the full width; value and the optional visual share the row below. */}
      <div className="flex items-center gap-2.5">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', iconTone)}>
          <Icon aria-hidden className="size-[1.125rem]" />
        </span>
        <p className="line-clamp-2 text-sm leading-tight font-medium text-stone-500">{label}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1.75rem] leading-none font-semibold tracking-tight text-brand-950 tabular-nums">
            {value}
          </p>
          {caption && <p className="mt-1.5 line-clamp-2 text-xs text-stone-500">{caption}</p>}
          {trend && (
            <p
              className={cn(
                'mt-1.5 inline-flex items-center gap-1 text-xs font-medium',
                trend.up ? 'text-success-700' : 'text-danger-700',
              )}
            >
              <Trend aria-hidden className="size-3.5" />
              {trend.value}
            </p>
          )}
        </div>
        {visual && <div className="shrink-0">{visual}</div>}
      </div>
    </div>
  )
}
