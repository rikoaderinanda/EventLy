import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate } from 'react-router'
import { env } from '@/config/env'
import { signOut } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-store'
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher'

function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  if (!user) return null

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-stone-600 sm:inline">
        {user.name} · {user.role}
      </span>
      <button
        type="button"
        onClick={() => void signOut().finally(() => navigate('/login', { replace: true }))}
        className="rounded-md border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-50"
      >
        {t('auth.signOut')}
      </button>
    </div>
  )
}

/**
 * Shared frame for the role areas. Each area gets its own layout component so later
 * phases can add role-specific navigation (sidebar for organizers, full-screen scanner for staff).
 */
export function AppShell({ area, children }: { area?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-brand-100 bg-white/80 px-4 py-3 backdrop-blur print:hidden">
        <Link to="/" className="flex items-center gap-2 font-semibold text-brand-900">
          <img src="/icon.svg" alt="" className="size-7" />
          {env.appName}
          {area && <span className="text-sm font-normal text-stone-500">· {area}</span>}
        </Link>
        <div className="flex items-center gap-3">
          <UserMenu />
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children ?? <Outlet />}</main>
    </div>
  )
}
