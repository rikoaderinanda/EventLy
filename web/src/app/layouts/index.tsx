import { type ReactNode, useEffect } from 'react'
import { matchPath, Outlet, useLocation } from 'react-router'
import { InstallPrompt, OfflineBanner } from '@/components/layout/AppBanners'
import { EventPickerButton, EventPickerProvider } from '@/components/layout/EventPicker'
import { useEventPicker } from '@/components/layout/eventPickerContext'
import { MobileHeader, PublicHeader, TopBar, UserMenu } from '@/components/layout/Header'
import { Logo } from '@/components/layout/Logo'
import { MobileNavigation } from '@/components/layout/MobileNavigation'
import {
  type NavGroup,
  type NavItem,
  useOrganizerMobileNav,
  useOrganizerNav,
  usePlatformMobileNav,
  usePlatformNav,
} from '@/components/layout/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { useSelectedEvent } from '@/features/events/selected-event'
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher'

/**
 * The signed-in frame: sidebar from 1024px, otherwise a slim header and the bottom navigation.
 * Pages render their own width and title inside <main>.
 */
function DashboardFrame({
  home,
  settingsPath,
  groups,
  mobileItems,
  sidebarTop,
  sidebarTopCollapsed,
  mobileHeaderSlot,
  onPickEvent,
}: {
  home: string
  settingsPath: string
  groups: NavGroup[]
  mobileItems: NavItem[]
  sidebarTop?: ReactNode
  sidebarTopCollapsed?: ReactNode
  mobileHeaderSlot?: ReactNode
  onPickEvent?: (page: string) => void
}) {
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar
        className="hidden lg:flex"
        home={home}
        groups={groups}
        top={sidebarTop}
        topCollapsed={sidebarTopCollapsed}
        onPickEvent={onPickEvent}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <MobileHeader className="lg:hidden" home={home} settingsPath={settingsPath}>
          {mobileHeaderSlot}
        </MobileHeader>
        <TopBar className="hidden lg:flex" settingsPath={settingsPath} />
        <main className="flex-1 px-4 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <MobileNavigation className="lg:hidden" items={mobileItems} onPickEvent={onPickEvent} />
      <InstallPrompt className="bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6" />
    </div>
  )
}

function OrganizerFrame() {
  const { pathname } = useLocation()
  const { selected, events, select } = useSelectedEvent()
  const { openPicker } = useEventPicker()
  const groups = useOrganizerNav(selected?.id ?? null)
  const mobileItems = useOrganizerMobileNav(selected?.id ?? null)

  // Opening an event's page makes it the selected event, so the menus follow what the user is looking at.
  const urlEventId = matchPath('/app/events/:id/*', pathname)?.params.id
  useEffect(() => {
    if (urlEventId && urlEventId !== selected?.id && events.some((e) => e.id === urlEventId))
      select(urlEventId)
  }, [urlEventId, selected?.id, events, select])

  return (
    <DashboardFrame
      home="/app"
      settingsPath="/app/settings"
      groups={groups}
      mobileItems={mobileItems}
      sidebarTop={<EventPickerButton />}
      sidebarTopCollapsed={<EventPickerButton compact />}
      mobileHeaderSlot={<EventPickerButton slim />}
      onPickEvent={openPicker}
    />
  )
}

/** Owner / Admin: modern SaaS frame with the event picker (Q-59). */
export function OrganizerLayout() {
  return (
    <EventPickerProvider>
      <OrganizerFrame />
    </EventPickerProvider>
  )
}

/** Root platform administrator: enterprise-minimal frame, Owners and Packages. */
export function PlatformLayout() {
  const groups = usePlatformNav()
  const mobileItems = usePlatformMobileNav()
  return (
    <DashboardFrame
      home="/platform"
      settingsPath="/platform/settings"
      groups={groups}
      mobileItems={mobileItems}
    />
  )
}

/** Staff: a slim bar and the page full width; the scanner gets its own full-screen design in UI-4. */
export function StaffLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-brand-100/70 bg-brand-50/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg sm:px-6 print:hidden">
        <Logo to="/staff" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <UserMenu settingsPath="/staff/settings" />
        </div>
      </header>
      <main className="flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <Outlet />
      </main>
      <InstallPrompt className="bottom-[max(1rem,env(safe-area-inset-bottom))]" />
    </div>
  )
}

/** The check-in scanner: full screen on near-black, so the camera and the results stand out at a dark venue. */
export function ScannerLayout() {
  return (
    <div className="min-h-dvh bg-stone-950 text-white">
      <OfflineBanner />
      <Outlet />
    </div>
  )
}

/** Public pages (home, login, legal, onboarding). */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <PublicHeader />
      <main className="flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <Outlet />
      </main>
    </div>
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
      <OfflineBanner />
      <Outlet />
    </div>
  )
}
