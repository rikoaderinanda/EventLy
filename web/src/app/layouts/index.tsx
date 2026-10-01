import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { useSession } from '@/features/auth/session-store'
import { AppShell } from './AppShell'

type NavItem = { to: string; label: string; end: boolean }

function TabNav({ links }: { links: NavItem[] }) {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.label')}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-brand-100 bg-white px-4 print:hidden"
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            [
              'border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
              isActive
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-stone-500 hover:text-stone-800',
            ].join(' ')
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

function OrganizerNav() {
  const { t } = useTranslation()
  const role = useSession((s) => s.user?.role)
  return (
    <TabNav
      links={[
        { to: '/app', label: t('nav.events'), end: true },
        { to: '/app/organization', label: t('nav.organization'), end: false },
        ...(role === 'Owner' ? [{ to: '/app/users', label: t('nav.users'), end: false }] : []),
      ]}
    />
  )
}

function PlatformNav() {
  const { t } = useTranslation()
  return (
    <TabNav
      links={[
        { to: '/platform', label: t('nav.owners'), end: true },
        { to: '/platform/packages', label: t('nav.packages'), end: false },
      ]}
    />
  )
}

export function AuthLayout() {
  return <AppShell />
}

/** Owner / Admin. Tab navigation now; a desktop sidebar comes with the event pages (Phase 4). */
export function OrganizerLayout() {
  return (
    <AppShell area="Dashboard">
      <OrganizerNav />
      <Outlet />
    </AppShell>
  )
}

/** Staff: full-screen, large touch targets for scanning at the venue. */
export function StaffLayout() {
  return <AppShell area="Staff" />
}

/** Root platform administrator: Owner accounts and the package catalog. */
export function PlatformLayout() {
  return (
    <AppShell area="Root">
      <PlatformNav />
      <Outlet />
    </AppShell>
  )
}

/**
 * Guest invitation pages: no app navigation, the event's own look. The page sends no referrer, so the
 * invitation code in the URL never reaches Google Maps or other sites (the server sets the same header).
 */
export function GuestLayout() {
  return (
    <div className="min-h-dvh bg-brand-50">
      <meta name="referrer" content="no-referrer" />
      <Outlet />
    </div>
  )
}
