import { Outlet } from 'react-router'
import { AppShell } from './AppShell'

export function AuthLayout() {
  return <AppShell />
}

/** Owner / Admin. Sidebar on desktop and bottom navigation on mobile are added in Phase 4. */
export function OrganizerLayout() {
  return <AppShell area="Dashboard" />
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
