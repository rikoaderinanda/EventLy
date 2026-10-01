import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ScanLine,
  Settings,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { matchPath } from 'react-router'
import { useSession } from '@/features/auth/session-store'

export type NavItem = {
  key: string
  label: string
  icon: LucideIcon
  /** Null for an event menu while no event is selected: the item then opens the event picker. */
  to: string | null
  /** For event menus, the page under /app/events/:id the item opens. */
  eventPage?: string
  isActive: (pathname: string) => boolean
}

export type NavGroup = { key: string; label?: string; items: NavItem[] }

const exact = (path: string) => (pathname: string) => pathname === path || pathname === `${path}/`
const under = (path: string) => (pathname: string) => pathname === path || pathname.startsWith(`${path}/`)
const eventSub = (page: string) => (pathname: string) => !!matchPath(`/app/events/:id/${page}/*`, pathname)

// "Acara" covers the list and an event's own pages, but not the pages that have their own menu.
const eventPages = ['guests', 'check-ins', 'payments', 'stats', 'reports']
const eventsActive = (pathname: string) =>
  under('/app/events')(pathname) && !eventPages.some((page) => eventSub(page)(pathname))

/** Sidebar groups of the organizer area (Owner, Admin); the event menus follow the selected event (Q-59). */
export function useOrganizerNav(selectedEventId: string | null): NavGroup[] {
  const { t } = useTranslation()
  const role = useSession((s) => s.user?.role)
  const eventItem = (key: string, label: string, icon: LucideIcon, page: string): NavItem => ({
    key,
    label,
    icon,
    to: selectedEventId ? `/app/events/${selectedEventId}/${page}` : null,
    eventPage: page,
    isActive: eventSub(page),
  })

  return [
    {
      key: 'main',
      items: [
        {
          key: 'dashboard',
          label: t('nav.dashboard'),
          icon: LayoutDashboard,
          to: '/app',
          isActive: exact('/app'),
        },
        {
          key: 'events',
          label: t('nav.events'),
          icon: CalendarDays,
          to: '/app/events',
          isActive: eventsActive,
        },
      ],
    },
    {
      key: 'event',
      label: t('nav.manageEvent'),
      items: [
        eventItem('guests', t('nav.guests'), Users, 'guests'),
        eventItem('checkins', t('nav.checkIn'), ScanLine, 'check-ins'),
        eventItem('payments', t('nav.payments'), CreditCard, 'payments'),
        eventItem('stats', t('nav.analytics'), BarChart3, 'stats'),
        eventItem('reports', t('nav.reports'), FileSpreadsheet, 'reports'),
      ],
    },
    {
      key: 'account',
      items: [
        {
          key: 'organization',
          label: t('nav.organization'),
          icon: Building2,
          to: '/app/organization',
          isActive: under('/app/organization'),
        },
        ...(role === 'Owner'
          ? [
              {
                key: 'users',
                label: t('nav.users'),
                icon: UserCog,
                to: '/app/users',
                isActive: under('/app/users'),
              },
            ]
          : []),
        {
          key: 'settings',
          label: t('nav.settings'),
          icon: Settings,
          to: '/app/settings',
          isActive: under('/app/settings'),
        },
      ],
    },
  ]
}

/** Bottom navigation on phones: Beranda · Acara · Tamu · Statistik · Profil. */
export function useOrganizerMobileNav(selectedEventId: string | null): NavItem[] {
  const { t } = useTranslation()
  const [main, event] = useOrganizerNav(selectedEventId)
  const find = (group: NavGroup | undefined, key: string) => group!.items.find((i) => i.key === key)!
  return [
    { ...find(main, 'dashboard'), label: t('nav.home') },
    find(main, 'events'),
    find(event, 'guests'),
    { ...find(event, 'stats'), label: t('nav.stats') },
    {
      key: 'profile',
      label: t('nav.profile'),
      icon: UserRound,
      to: '/app/settings',
      isActive: under('/app/settings'),
    },
  ]
}

export function usePlatformNav(): NavGroup[] {
  const { t } = useTranslation()
  return [
    {
      key: 'main',
      items: [
        {
          key: 'owners',
          label: t('nav.owners'),
          icon: Building2,
          to: '/platform',
          isActive: (p) => exact('/platform')(p) || under('/platform/owners')(p),
        },
        {
          key: 'packages',
          label: t('nav.packages'),
          icon: Package,
          to: '/platform/packages',
          isActive: under('/platform/packages'),
        },
      ],
    },
    {
      key: 'account',
      items: [
        {
          key: 'settings',
          label: t('nav.settings'),
          icon: Settings,
          to: '/platform/settings',
          isActive: under('/platform/settings'),
        },
      ],
    },
  ]
}

export function usePlatformMobileNav(): NavItem[] {
  const { t } = useTranslation()
  const [main] = usePlatformNav()
  return [
    ...main!.items,
    {
      key: 'profile',
      label: t('nav.profile'),
      icon: UserRound,
      to: '/platform/settings',
      isActive: under('/platform/settings'),
    },
  ]
}
