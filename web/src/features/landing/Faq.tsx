import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LandingSection, SectionHeading } from './Section'

/** Native <details>: keyboard and screen readers work without any script. */
export function Faq() {
  const { t } = useTranslation()
  const items = t('landing.faq.items', { returnObjects: true }) as { q: string; a: string }[]

  return (
    <LandingSection id="faq" labelledBy="faq-title" className="bg-white/60">
      <SectionHeading id="faq-title" eyebrow={t('landing.faq.eyebrow')} title={t('landing.faq.title')} />
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-brand-100 bg-white shadow-soft open:shadow-lift"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-brand-950 [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                aria-hidden
                className="size-5 shrink-0 text-brand-600 transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <p className="px-5 pb-5 text-stone-600">{item.a}</p>
          </details>
        ))}
      </div>
    </LandingSection>
  )
}
