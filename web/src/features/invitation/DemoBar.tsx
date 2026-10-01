import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/components/ui/cn'
import { publicKeys, type PublicInvitation } from './api'
import { DEMO_CODE, demo } from './demo'
import { invitationThemes, type InvitationTheme } from './themes'

/**
 * Shown only on the demo invitation: says the data is fictional, lets the visitor try the three themes,
 * and leads to sign-up. It sits above the cover, so it is visible from the first second.
 */
export function DemoBar({ theme }: { theme: InvitationTheme }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  function choose(next: InvitationTheme) {
    demo.setTheme(next)
    queryClient.setQueryData<PublicInvitation>(
      publicKeys.invitation(DEMO_CODE),
      (old) => old && { ...old, event: { ...old.event, theme: next } },
    )
  }

  return (
    <aside
      aria-label={t('demo.label')}
      className="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-stone-950/90 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          to="/"
          aria-label={t('demo.back')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <ArrowLeft aria-hidden className="size-4" />
        </Link>
        <p className="min-w-0 flex-1 text-xs leading-tight sm:text-sm">
          <span className="font-semibold">{t('demo.title')}</span>
          <span className="hidden text-white/70 sm:inline"> · {t('demo.fictional')}</span>
        </p>
        <Link
          to="/login"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-stone-950 hover:bg-brand-50 sm:text-sm"
        >
          <Sparkles aria-hidden className="size-3.5" />
          {t('landing.cta.start')}
        </Link>
        <div role="group" aria-label={t('demo.themes')} className="flex w-full gap-1.5 sm:w-auto">
          {invitationThemes.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === theme}
              onClick={() => choose(option)}
              className={cn(
                'h-8 flex-1 rounded-full px-3 text-xs font-medium transition-colors sm:flex-none',
                option === theme
                  ? 'bg-gold-300 text-stone-950'
                  : 'bg-white/10 text-white/85 hover:bg-white/20',
              )}
            >
              {t(`themes.${option}`)}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
