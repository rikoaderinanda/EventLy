import { Building2, ChevronRight, LogOut, type LucideIcon, UserCog } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSignOut } from '@/components/layout/useSignOut'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, SectionHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { locales, type Locale } from '@/config/env'
import { useSession } from '@/features/auth/session-store'
import { changeLocale } from '@/i18n'

function LinkRow({
  to,
  icon: Icon,
  label,
  description,
}: {
  to: string
  icon: LucideIcon
  label: string
  description: string
}) {
  return (
    <li>
      <Link to={to} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-brand-50">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icon aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-brand-950">{label}</span>
          <span className="block truncate text-sm text-stone-500">{description}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 text-stone-400" />
      </Link>
    </li>
  )
}

/** Profile and settings of the signed-in user (Q-65): who I am, language, links, sign out. */
export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const user = useSession((s) => s.user)
  const leave = useSignOut()
  if (!user) return null
  const organizer = user.role === 'Owner' || user.role === 'Admin'

  return (
    <section className="mx-auto max-w-2xl space-y-5 py-6 sm:py-10">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Card className="flex items-center gap-4">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-card">{user.name}</p>
          <p className="truncate text-sm text-stone-500">{user.email}</p>
        </div>
        <Badge tone="brand">{t(`roles.${user.role}`)}</Badge>
      </Card>

      <Card>
        <SectionHeader title={t('language')} description={t('settings.languageHint')} level={3} />
        <div role="group" aria-label={t('language')} className="inline-flex rounded-xl bg-brand-100/70 p-1">
          {locales.map((locale) => {
            const current = i18n.resolvedLanguage === locale
            return (
              <button
                key={locale}
                type="button"
                aria-pressed={current}
                onClick={() => changeLocale(locale as Locale)}
                className={cn(
                  'h-10 rounded-lg px-4 text-sm font-medium transition-colors',
                  current ? 'bg-white text-brand-800 shadow-soft' : 'text-stone-600 hover:text-brand-900',
                )}
              >
                {t(`settings.locale.${locale}`)}
              </button>
            )
          })}
        </div>
      </Card>

      {organizer && (
        <Card>
          <ul className="divide-y divide-brand-100">
            <LinkRow
              to="/app/organization"
              icon={Building2}
              label={t('nav.organization')}
              description={t('settings.organizationHint')}
            />
            {user.role === 'Owner' && (
              <LinkRow
                to="/app/users"
                icon={UserCog}
                label={t('nav.users')}
                description={t('settings.usersHint')}
              />
            )}
          </ul>
        </Card>
      )}

      <Button variant="secondary" icon={LogOut} block="mobile" onClick={leave} className="text-danger-700">
        {t('auth.signOut')}
      </Button>
    </section>
  )
}
