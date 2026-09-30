import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { useSession } from '@/features/auth/session-store'
import { AppShell } from './AppShell'

function OrganizerNav() {
  const { t } = useTranslation()
  const role = useSession((s) => s.user?.role)
  const links = [
    { to: '/app', label: t('nav.events'), end: true },
    { to: '/app/organization', label: t('nav.organization'), end: false },
    ...(role === 'Owner' ? [{ to: '/app/users', label: t('nav.users'), end: false }] : []),
  ]

  return (
    <nav
      aria-label={t('nav.label')}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-brand-100 bg-white px-4"
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

/** Root platform administrator. */
export function PlatformLayout() {
  return <AppShell area="Root" />
}

/** Guest invitation pages: no app navigation, the event's own look. */
export function GuestLayout() {
  return (
    <div className="min-h-dvh bg-brand-50">
      <Outlet />
    </div>
  )
}
