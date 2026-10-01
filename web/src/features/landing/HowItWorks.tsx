import { useTranslation } from 'react-i18next'
import { Reveal } from '@/components/ui/Reveal'
import { LandingSection, SectionHeading } from './Section'

/** The seven real steps, as an ordered timeline (one column on phones, a zig-zag line on desktop). */
export function HowItWorks() {
  const { t } = useTranslation()
  const steps = t('landing.how.steps', { returnObjects: true }) as { title: string; body: string }[]

  return (
    <LandingSection id="how" labelledBy="how-title" className="bg-white/60">
      <SectionHeading
        id="how-title"
        eyebrow={t('landing.how.eyebrow')}
        title={
          <>
            {t('landing.how.title1')}
            <br className="hidden sm:block" /> {t('landing.how.title2')}
          </>
        }
      />
      <ol className="relative mx-auto mt-14 max-w-3xl space-y-4 before:absolute before:top-6 before:bottom-6 before:left-6 before:w-px before:bg-brand-200 sm:before:left-1/2">
        {steps.map((step, index) => (
          <li key={step.title} className="relative sm:grid sm:grid-cols-2 sm:gap-10">
            <Reveal
              delay={60}
              className={index % 2 === 0 ? 'sm:col-start-1 sm:text-right' : 'sm:col-start-2'}
            >
              <div className="ml-16 rounded-2xl border border-brand-100 bg-white p-5 shadow-soft sm:ml-0">
                <h3 className="text-card">{step.title}</h3>
                <p className="mt-1 text-sm text-stone-600">{step.body}</p>
              </div>
            </Reveal>
            <span
              aria-hidden
              className="absolute top-3 left-0 flex size-12 items-center justify-center rounded-full bg-primary-gradient font-display text-lg font-semibold text-white shadow-primary ring-4 ring-brand-50 sm:left-1/2 sm:-translate-x-1/2"
            >
              {index + 1}
            </span>
          </li>
        ))}
      </ol>
    </LandingSection>
  )
}
