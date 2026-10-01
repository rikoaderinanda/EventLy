import { ArrowRight, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { DEMO_CODE } from '@/features/invitation/demo'

/** The closing ask, on the brand gradient. */
export function FinalCta() {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="final-title" className="px-4 pb-16 sm:px-6 sm:pb-24">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-linear-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="absolute -top-24 -right-16 size-72 rounded-full bg-gold-300/25 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-28 -left-16 size-80 rounded-full bg-brand-400/30 blur-3xl"
          />
          <h2
            id="final-title"
            className="relative mx-auto max-w-3xl font-display text-3xl leading-tight font-semibold text-white sm:text-5xl"
          >
            {t('landing.final.title')}
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-lg text-white/80">
            {t('landing.final.subtitle')}
          </p>
          <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex h-13 items-center justify-center gap-2.5 rounded-xl bg-white px-7 font-semibold text-brand-900 shadow-lift transition-transform hover:bg-brand-50 active:scale-[0.98]"
            >
              {t('landing.cta.start')}
              <ArrowRight aria-hidden className="size-5" />
            </Link>
            <ButtonLink
              to={`/i/${DEMO_CODE}`}
              variant="ghost"
              size="lg"
              icon={Eye}
              className="text-white ring-1 ring-white/30 ring-inset hover:bg-white/10 hover:text-white"
            >
              {t('landing.cta.demo')}
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
