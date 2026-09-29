import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router'
import { env } from '@/config/env'
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher'

/**
 * Shared frame for the role areas. Each area gets its own layout component so later
 * phases can add role-specific navigation (sidebar for organizers, full-screen scanner for staff).
 */
export function AppShell({ area, children }: { area?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-brand-100 bg-white/80 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-semibold text-brand-900">
          <img src="/icon.svg" alt="" className="size-7" />
          {env.appName}
          {area && <span className="text-sm font-normal text-stone-500">· {area}</span>}
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children ?? <Outlet />}</main>
    </div>
  )
}
