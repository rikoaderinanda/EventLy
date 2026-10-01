import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article' | 'li'
  /** Lifts on hover; use for cards that are a link or a button. */
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' }

/**
 * The surface every dashboard block sits on: white, a hairline border and a soft shadow.
 * Prefer whitespace and headings over nesting cards inside cards.
 */
export function Card({ as: Tag = 'div', interactive, padding = 'md', className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-brand-100 bg-white shadow-soft',
        interactive &&
          'transition-[box-shadow,transform,border-color] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift',
        paddings[padding],
        className,
      )}
      {...rest}
    />
  )
}

/** Title row of a card or section: title, optional description, optional actions on the right. */
export function SectionHeader({
  title,
  description,
  actions,
  level = 2,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  level?: 2 | 3
  className?: string
}) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <Heading className={level === 2 ? 'text-section' : 'text-card'}>{title}</Heading>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Page title block: large title, subtitle and the page's main actions. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm font-medium text-brand-600">{eyebrow}</div>}
        <h1 className="text-page-responsive">{title}</h1>
        {subtitle && <p className="mt-2 text-body text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </header>
  )
}
