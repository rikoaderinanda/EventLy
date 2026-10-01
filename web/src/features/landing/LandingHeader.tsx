import { LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/layout/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { LanguageSwitcher } from '@/shared/components/LanguageSwitcher'
import { landingAnchors } from './anchors'

/** Sticky top bar: logo, section links (desktop), language, sign in, and the main call to action. */
export function LandingHeader() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-200',
        scrolled
          ? 'border-b border-brand-100/80 bg-brand-50/85 shadow-soft backdrop-blur-lg'
          : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label={t('landing.nav.menu')} className="ml-6 hidden flex-1 lg:block">
          <ul className="flex gap-1">
            {landingAnchors.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-white/70 hover:text-brand-900"
                >
                  {t(`landing.nav.${id}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* On phones the language is switched in the footer, so the call to action fits. */}
          <span className="hidden sm:inline-flex">
            <LanguageSwitcher />
          </span>
          <ButtonLink to="/login" variant="ghost" size="sm" icon={LogIn} className="hidden sm:inline-flex">
            {t('landing.nav.signIn')}
          </ButtonLink>
          <ButtonLink to="/login" size="sm">
            {t('landing.cta.start')}
          </ButtonLink>
        </div>
      </div>
    </header>
  )
}
