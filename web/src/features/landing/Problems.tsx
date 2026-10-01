import { ArrowDown, ClipboardList, MailWarning, Timer, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Reveal } from '@/components/ui/Reveal'
import { LandingSection, SectionHeading } from './Section'

const icons: LucideIcon[] = [MailWarning, ClipboardList, Timer]

/** The pain the organizer already feels, then the turn to the answer. */
export function Problems() {
  const { t } = useTranslation()
  const items = t('landing.problems.items', { returnObjects: true }) as { title: string; body: string }[]

  return (
    <LandingSection labelledBy="problems-title" className="bg-white/60">
      <SectionHeading
        id="problems-title"
        eyebrow={t('landing.problems.eyebrow')}
        title={t('landing.problems.title')}
      />
      <ul className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map((item, index) => {
          const Icon = icons[index] ?? MailWarning
          return (
            <li key={item.title}>
              <Reveal delay={index * 90} className="h-full">
                <div className="h-full rounded-3xl border border-brand-100 bg-brand-50/60 p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-danger-50 text-danger-700">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-5 text-card">{item.title}</h3>
                  <p className="mt-2 text-stone-600">{item.body}</p>
                </div>
              </Reveal>
            </li>
          )
        })}
      </ul>
      <Reveal className="mt-12 flex flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-gradient text-white shadow-primary">
          <ArrowDown aria-hidden className="size-5" />
        </span>
        <p className="max-w-xl font-display text-2xl leading-snug font-semibold text-brand-900">
          {t('landing.problems.bridge')}
        </p>
      </Reveal>
    </LandingSection>
  )
}
