import { Link } from 'react-router'
import { cn } from '@/components/ui/cn'
import { env } from '@/config/env'

/** The app mark (the same drawing as the PWA icon) with the name; `compact` shows only the mark. */
export function Logo({
  to = '/',
  compact,
  className,
}: {
  to?: string
  compact?: boolean
  className?: string
}) {
  return (
    <Link
      to={to}
      aria-label={compact ? env.appName : undefined}
      className={cn('inline-flex items-center gap-2.5 rounded-lg', className)}
    >
      <img src="/icon.svg" alt="" className="size-8 shrink-0 rounded-[0.6rem] shadow-primary" />
      {!compact && <span className="text-lg font-semibold tracking-tight text-brand-950">{env.appName}</span>}
    </Link>
  )
}
