import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/components/ui/cn'
import { useSession } from '@/features/auth/session-store'
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher'
import { Logo } from './Logo'
import { useSignOut } from './useSignOut'

/** Avatar button with a small menu: settings and sign out. */
export function UserMenu({ settingsPath }: { settingsPath: string }) {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const leave = useSignOut()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-white"
      >
        <Avatar name={user.name} size="sm" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-medium text-brand-950">{user.name}</span>
          <span className="block text-xs text-stone-500">{t(`roles.${user.role}`)}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 text-stone-400" />
        <span className="sr-only">{t('nav.accountMenu')}</span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-brand-100 bg-white p-1.5 shadow-lift"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-brand-950">{user.name}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-brand-100" />
          <Link
            to={settingsPath}
            onClick={() => setOpen(false)}
            className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-stone-700 hover:bg-brand-50"
          >
            <Settings aria-hidden className="size-4 text-stone-400" />
            {t('nav.settings')}
          </Link>
          <button
            type="button"
            onClick={leave}
            className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-danger-700 hover:bg-danger-50"
          >
            <LogOut aria-hidden className="size-4" />
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Desktop top bar of the content area: page context on the left, language and account on the right. */
export function TopBar({
  children,
  settingsPath,
  className,
}: {
  children?: ReactNode
  settingsPath: string
  className?: string
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-16 items-center justify-between gap-4 border-b border-brand-100/70 bg-brand-50/80 px-8 backdrop-blur-lg print:hidden',
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <UserMenu settingsPath={settingsPath} />
      </div>
    </header>
  )
}

/** Phone header: the mark, an optional middle slot (the event picker) and the avatar linking to the profile. */
export function MobileHeader({
  home,
  settingsPath,
  children,
  className,
}: {
  home: string
  settingsPath: string
  children?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-brand-100/70 bg-brand-50/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg print:hidden',
        className,
      )}
    >
      <Logo to={home} compact />
      <div className="min-w-0 flex-1">{children}</div>
      {user && (
        <Link to={settingsPath} aria-label={t('nav.profile')} className="rounded-full">
          <Avatar name={user.name} size="sm" className="size-10" />
        </Link>
      )}
    </header>
  )
}

/** Plain header for the public pages (home, login, legal): logo and language only. */
export function PublicHeader() {
  return (
    <header className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 print:hidden">
      <Logo />
      <LanguageSwitcher />
    </header>
  )
}
