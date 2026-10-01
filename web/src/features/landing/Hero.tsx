import { ArrowRight, Check, Eye, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { DEMO_CODE } from '@/features/invitation/demo'
import { PhoneMockup } from './PhoneMockup'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
})

/** Above the fold: what EventLy is, in one look, with the two ways forward (sign up, or try the demo). */
export function Hero() {
  const { t } = useTranslation()
  const points = t('landing.hero.points', { returnObjects: true }) as string[]

  return (
    <section aria-labelledby="hero-title" className="relative px-4 pt-8 pb-16 sm:px-6 sm:pt-14 lg:pb-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <div className="text-center lg:text-left">
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full bg-gold-100/80 px-3 py-1 text-xs font-medium text-gold-700 ring-1 ring-gold-300/50"
          >
            <Sparkles aria-hidden className="size-3.5" />
            {t('landing.hero.badge')}
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            id="hero-title"
            className="mt-6 font-display text-[2.6rem] leading-[1.08] font-semibold tracking-tight sm:text-6xl"
          >
            {t('landing.hero.title1')} <span className="text-brand-600">{t('landing.hero.title2')}</span>
          </motion.h1>
          <motion.p
            {...rise(0.16)}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-600 lg:mx-0"
          >
            {t('landing.hero.subtitle')}
          </motion.p>
          <motion.div
            {...rise(0.24)}
            className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <ButtonLink to="/login" size="lg" iconRight={ArrowRight}>
              {t('landing.cta.start')}
            </ButtonLink>
            <ButtonLink to={`/i/${DEMO_CODE}`} variant="secondary" size="lg" icon={Eye}>
              {t('landing.cta.demo')}
            </ButtonLink>
          </motion.div>
          <motion.p {...rise(0.3)} className="mt-3 text-sm text-stone-500">
            {t('landing.hero.note')}
          </motion.p>
          <motion.ul
            {...rise(0.36)}
            className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-stone-700 lg:justify-start"
          >
            {points.map((point) => (
              <li key={point} className="inline-flex items-center gap-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-success-50 text-success-700">
                  <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                </span>
                {point}
              </li>
            ))}
          </motion.ul>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  )
}
