import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { cn } from '@/components/ui/cn'
import { locales, type Locale } from '@/config/env'
import { useSystemInfo } from '@/features/system/api'
import { changeLocale } from '@/i18n'
import { landingAnchors } from './anchors'

/** Server status, for developers only: visitors don't need it. */
function ApiStatus() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useSystemInfo()
  const [dot, label] = isPending
    ? ['bg-stone-300', t('home.apiChecking')]
    : isError
      ? ['bg-danger-500', t('home.apiOffline')]
      : ['bg-success-500', `${t('home.apiOnline')} · v${data.version} · ${data.environment}`]
  return (
    <p className="inline-flex items-center gap-2 text-xs text-stone-500">
      <span className={cn('size-2 rounded-full', dot)} aria-hidden />
      {t('home.apiStatus')}: {label}
    </p>
  )
}

export function LandingFooter() {
  const { t, i18n } = useTranslation()
  return (
    <footer className="border-t border-brand-100 bg-white/60 px-4 py-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-stone-600">{t('landing.footer.tagline')}</p>
        </div>
        <nav aria-label={t('landing.nav.menu')}>
          <ul className="space-y-2 text-sm">
            {landingAnchors.map((id) => (
              <li key={id}>
                <a href={`#${id}`} className="text-stone-600 hover:text-brand-800">
                  {t(`landing.nav.${id}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-4 text-sm">
          <ul className="space-y-2">
            <li>
              <Link to="/legal/terms" className="text-stone-600 hover:text-brand-800">
                {t('legal.terms')}
              </Link>
            </li>
            <li>
              <Link to="/legal/privacy" className="text-stone-600 hover:text-brand-800">
                {t('legal.privacy')}
              </Link>
            </li>
          </ul>
          <div
            role="group"
            aria-label={t('landing.footer.language')}
            className="flex items-center gap-1 text-sm"
          >
            {locales.map((locale, index) => (
              <span key={locale} className="flex items-center gap-1">
                {index > 0 && (
                  <span aria-hidden className="text-stone-300">
                    |
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={i18n.resolvedLanguage === locale}
                  onClick={() => changeLocale(locale as Locale)}
                  className={cn(
                    'min-h-9 rounded-md px-2 font-medium',
                    i18n.resolvedLanguage === locale
                      ? 'text-brand-800'
                      : 'text-stone-500 hover:text-brand-800',
                  )}
                >
                  {locale.toUpperCase()}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-6 text-xs text-stone-500">
        <p>© {new Date().getFullYear()} EventLy</p>
        {import.meta.env.DEV && <ApiStatus />}
      </div>
    </footer>
  )
}
