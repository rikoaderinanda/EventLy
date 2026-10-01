import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { cn } from '@/components/ui/cn'
import type { NavItem } from './navigation'

/**
 * Bottom navigation on phones and tablets: up to five destinations, icon above a short label, the
 * active one in a soft pill. It sits above the home indicator (safe area).
 */
export function MobileNavigation({
  items,
  onPickEvent,
  className,
}: {
  items: NavItem[]
  onPickEvent?: (page: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <nav
      aria-label={t('nav.label')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg print:hidden',
        className,
      )}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = item.isActive(pathname)
          const Icon = item.icon
          const inner = (
            <>
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200',
                  active ? 'bg-brand-100 text-brand-700' : 'text-stone-500',
                )}
              >
                <Icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span
                className={cn(
                  'text-[0.6875rem] leading-none',
                  active ? 'font-semibold text-brand-800' : 'text-stone-500',
                )}
              >
                {item.label}
              </span>
            </>
          )
          const classes =
            'flex h-16 w-full flex-col items-center justify-center gap-1 active:scale-95 transition-transform'
          return (
            <li key={item.key} className="flex-1">
              {item.to === null ? (
                <button type="button" className={classes} onClick={() => onPickEvent?.(item.eventPage ?? '')}>
                  {inner}
                </button>
              ) : (
                <Link to={item.to} aria-current={active ? 'page' : undefined} className={classes}>
                  {inner}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
