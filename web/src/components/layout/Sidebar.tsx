import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { cn } from '@/components/ui/cn'
import { Logo } from './Logo'
import type { NavGroup, NavItem } from './navigation'

const storageKey = 'evently.sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

function NavEntry({
  item,
  collapsed,
  onPickEvent,
}: {
  item: NavItem
  collapsed: boolean
  onPickEvent?: (page: string) => void
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = item.isActive(pathname)
  const Icon = item.icon
  const classes = cn(
    'group flex h-10 w-full items-center gap-3 rounded-xl text-sm font-medium transition-colors',
    collapsed ? 'justify-center px-0' : 'px-3',
    active ? 'bg-white text-brand-800 shadow-soft' : 'text-stone-600 hover:bg-white/60 hover:text-brand-900',
  )
  const content = (
    <>
      <Icon
        aria-hidden
        className={cn(
          'size-[1.125rem] shrink-0',
          active ? 'text-brand-600' : 'text-stone-400 group-hover:text-brand-600',
        )}
      />
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
    </>
  )

  if (item.to === null)
    return (
      <button
        type="button"
        className={cn(classes, 'text-stone-400')}
        title={collapsed ? item.label : t('eventPicker.pickFirst')}
        onClick={() => onPickEvent?.(item.eventPage ?? '')}
      >
        {content}
      </button>
    )
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={classes}
    >
      {content}
    </Link>
  )
}

/**
 * Desktop sidebar: logo, an optional slot (the event picker), grouped menus and a collapse toggle.
 * Collapsed, it keeps only the icons (labels stay for screen readers and as tooltips); the choice is remembered.
 */
export function Sidebar({
  groups,
  home,
  top,
  topCollapsed,
  onPickEvent,
  className,
}: {
  groups: NavGroup[]
  home: string
  top?: ReactNode
  topCollapsed?: ReactNode
  onPickEvent?: (page: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  function toggle() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(storageKey, value ? '0' : '1')
      } catch {
        // Private mode: the choice just isn't remembered.
      }
      return !value
    })
  }

  return (
    <aside
      className={cn(
        'sticky top-0 h-dvh shrink-0 flex-col border-r border-brand-100 bg-brand-100/40 transition-[width] duration-200 ease-out-soft print:hidden',
        collapsed ? 'w-[4.5rem]' : 'w-64',
        className,
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Logo to={home} compact={collapsed} />
      </div>
      {top && (
        <div className={cn('pb-3', collapsed ? 'flex justify-center' : 'px-3')}>
          {collapsed ? topCollapsed : top}
        </div>
      )}
      <nav aria-label={t('nav.label')} className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.key}>
            {group.label &&
              (collapsed ? (
                <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-brand-200" />
              ) : (
                <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wider text-stone-400 uppercase">
                  {group.label}
                </p>
              ))}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <NavEntry item={item} collapsed={collapsed} onPickEvent={onPickEvent} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className={cn('border-t border-brand-100 p-3', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-500 hover:bg-white/60 hover:text-brand-900"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-[1.125rem]" />
          ) : (
            <PanelLeftClose aria-hidden className="size-[1.125rem]" />
          )}
          {!collapsed && <span>{t('nav.collapse')}</span>}
        </button>
      </div>
    </aside>
  )
}
