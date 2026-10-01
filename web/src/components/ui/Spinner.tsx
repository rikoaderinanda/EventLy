import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'

/** Decorative spinner (inside a button that already says what is happening). */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn('size-4 animate-spin', className)} />
}

/** A loading block for a page or section, announced to screen readers. */
export function Loading({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className={cn('flex items-center justify-center gap-2 py-10 text-stone-500', className)}
    >
      <Spinner className="size-5 text-brand-500" />
      <span className="text-sm">{label ?? t('common.loading')}</span>
    </div>
  )
}

/** Grey placeholder shape while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-brand-100', className)} />
}
