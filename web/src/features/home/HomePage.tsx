import { ArrowRight, Camera, Gift, LogIn, MailOpen, ScanLine, Sparkles, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { useSystemInfo } from '@/features/system/api'
import '@/features/invitation/fonts'

function ApiStatus() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useSystemInfo()

  const [dot, label] = isPending
    ? ['bg-stone-300', t('home.apiChecking')]
    : isError
      ? ['bg-danger-500', t('home.apiOffline')]
      : ['bg-success-500', `${t('home.apiOnline')} · v${data.version} · ${data.environment}`]

  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs text-stone-600 ring-1 ring-brand-100">
      <span className={cn('size-2 rounded-full', dot)} aria-hidden />
      <span>
        {t('home.apiStatus')}: {label}
      </span>
    </p>
  )
}

const features: { key: string; icon: LucideIcon }[] = [
  { key: 'invite', icon: MailOpen },
  { key: 'rsvp', icon: UsersRound },
  { key: 'checkin', icon: ScanLine },
  { key: 'photos', icon: Camera },
]

/** A miniature invitation card, so the page shows the product instead of describing it. */
function InvitationMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-linear-to-br from-brand-200/60 via-gold-100/60 to-transparent blur-2xl" />
      <div className="rotate-[-3deg] rounded-[2rem] bg-linear-to-b from-brand-50 to-white p-8 text-center shadow-lift ring-1 ring-brand-100">
        <p className="text-[0.625rem] tracking-[0.35em] text-stone-500 uppercase">Undangan Pernikahan</p>
        <p className="mt-4 font-serif text-5xl font-medium text-brand-950">Rina &amp; Budi</p>
        <p className="mt-3 text-sm text-stone-500">Sabtu, 12 Desember 2026</p>
        <svg viewBox="0 0 200 20" className="mx-auto mt-5 h-4 w-32 text-gold-500">
          <path d="M0 10h78M122 10h78" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <path d="M100 2l6 8-6 8-6-8z" fill="currentColor" />
        </svg>
        <p className="mt-5 text-xs text-stone-500">Kepada Yth.</p>
        <p className="text-lg font-semibold text-brand-950">Keluarga Wijaya</p>
        <span className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary-gradient px-6 text-sm font-semibold text-white shadow-primary">
          <MailOpen className="size-4" />
          Buka Undangan
        </span>
      </div>
      <div className="absolute -right-2 -bottom-6 flex rotate-[4deg] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-brand-100">
        <span className="flex size-9 items-center justify-center rounded-full bg-success-50 text-success-700">
          <ScanLine className="size-5" />
        </span>
        <span className="text-left text-xs">
          <span className="block font-semibold text-brand-950">Check-in berhasil</span>
          <span className="text-stone-500">Keluarga Wijaya · 4 orang</span>
        </span>
      </div>
    </div>
  )
}

/** Public landing page: what EventLy does, and the way in. */
export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-6xl">
      <section className="grid items-center gap-14 py-10 sm:py-16 lg:grid-cols-2 lg:py-24">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-gold-100/70 px-3 py-1 text-xs font-medium text-gold-700">
            <Sparkles aria-hidden className="size-3.5" />
            {t('home.eyebrow')}
          </p>
          <h1 className="mt-5 font-display text-4xl leading-[1.1] font-semibold sm:text-5xl lg:text-6xl">
            {t('home.title')}
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg text-stone-600 lg:mx-0">{t('home.subtitle')}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <ButtonLink to="/login" size="lg" icon={LogIn}>
              {t('home.start')}
            </ButtonLink>
            <ButtonLink to="/login" variant="secondary" size="lg" iconRight={ArrowRight}>
              {t('home.signIn')}
            </ButtonLink>
          </div>
          <div className="mt-8">
            <ApiStatus />
          </div>
        </div>
        <InvitationMock />
      </section>

      <section aria-labelledby="features" className="pb-16">
        <h2 id="features" className="text-center text-section">
          {t('home.featuresTitle')}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ key, icon: Icon }) => (
            <li key={key} className="rounded-2xl border border-brand-100 bg-white p-6 shadow-soft">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="mt-4 text-card">{t(`home.feature.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm text-stone-600">{t(`home.feature.${key}.body`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-stone-500">
          <Gift aria-hidden className="size-4 text-gold-500" />
          {t('home.extras')}
        </p>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-brand-100 py-8 text-sm text-stone-500">
        <Link to="/legal/terms" className="hover:text-brand-800">
          {t('legal.terms')}
        </Link>
        <Link to="/legal/privacy" className="hover:text-brand-800">
          {t('legal.privacy')}
        </Link>
      </footer>
    </div>
  )
}
