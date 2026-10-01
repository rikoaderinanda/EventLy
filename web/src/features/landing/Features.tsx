import {
  Camera,
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  Gift,
  Images,
  Info,
  MailOpen,
  ScanLine,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/components/ui/cn'
import { Reveal } from '@/components/ui/Reveal'
import '@/features/invitation/fonts'
import { invitationThemes, themes } from '@/features/invitation/themes'
import { LandingSection, SectionHeading } from './Section'

type FeatureText = { title: string; body: string; points: string[]; note?: string }

/** The three real invitation themes, drawn from the same theme objects the invitation uses. */
function ThemesVisual() {
  const { t } = useTranslation()
  return (
    <div aria-hidden className="grid grid-cols-3 gap-2">
      {invitationThemes.map((name) => {
        const look = themes[name]
        return (
          <div key={name} className="overflow-hidden rounded-xl ring-1 ring-black/5">
            <div
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1"
              style={{ background: look.backgroundStyle }}
            >
              <span className={cn('text-lg leading-none', look.fontHeading)} style={{ color: look.ink }}>
                R &amp; B
              </span>
              <span className="h-1 w-6 rounded-full" style={{ background: look.secondaryColor }} />
            </div>
            <p className="bg-white py-1 text-center text-[0.65rem] font-medium text-stone-600">
              {t(`themes.${name}`)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function RsvpVisual() {
  const rows = [
    { icon: CircleCheck, tone: 'text-success-700 bg-success-50', width: 'w-[68%]', bar: 'bg-success-500' },
    { icon: CircleX, tone: 'text-danger-700 bg-danger-50', width: 'w-[12%]', bar: 'bg-danger-500' },
    { icon: CircleDashed, tone: 'text-stone-500 bg-stone-100', width: 'w-[20%]', bar: 'bg-stone-300' },
  ]
  return (
    <div aria-hidden className="space-y-2.5 rounded-2xl bg-white p-4 ring-1 ring-brand-100">
      {rows.map(({ icon: Icon, tone, width, bar }, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className={cn('flex size-7 items-center justify-center rounded-full', tone)}>
            <Icon className="size-4" />
          </span>
          <span className="h-2 flex-1 rounded-full bg-brand-100">
            <span className={cn('block h-full rounded-full', width, bar)} />
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 border-t border-brand-100 pt-2.5 text-xs text-stone-500">
        <Gift className="size-4 text-gold-500" />
        <span className="h-2 w-24 rounded-full bg-gold-100" />
      </div>
    </div>
  )
}

function ScannerVisual() {
  const corner = 'absolute size-6 border-white'
  return (
    <div
      aria-hidden
      className="relative mx-auto flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-stone-950"
    >
      <div className="relative size-24">
        <span className={`${corner} top-0 left-0 rounded-tl-lg border-t-[3px] border-l-[3px]`} />
        <span className={`${corner} top-0 right-0 rounded-tr-lg border-t-[3px] border-r-[3px]`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-lg border-b-[3px] border-l-[3px]`} />
        <span className={`${corner} right-0 bottom-0 rounded-br-lg border-r-[3px] border-b-[3px]`} />
        <span className="absolute inset-x-3 top-1/2 h-0.5 rounded-full bg-gold-300 shadow-[0_0_12px_2px_rgb(226_199_102/0.7)]" />
      </div>
      <span className="absolute bottom-3 inline-flex items-center gap-1.5 rounded-full bg-success-500 px-3 py-1 text-xs font-semibold text-white">
        <Check className="size-3.5" />
        Check-in
      </span>
    </div>
  )
}

function GalleryVisual() {
  const tones = [
    'from-brand-200 to-brand-300',
    'from-gold-100 to-gold-300',
    'from-rose-100 to-rose-200',
    'from-sky-100 to-sky-200',
    'from-brand-100 to-gold-100',
    'from-success-50 to-success-100',
  ]
  return (
    <div aria-hidden className="grid grid-cols-3 gap-2">
      {tones.map((tone, i) => (
        <span
          key={i}
          className={cn('flex aspect-square items-center justify-center rounded-xl bg-linear-to-br', tone)}
        >
          {i === 1 && <Camera className="size-5 text-white/90" />}
        </span>
      ))}
    </div>
  )
}

const visuals: { icon: LucideIcon; visual: ReactNode }[] = [
  { icon: MailOpen, visual: <ThemesVisual /> },
  { icon: CircleCheck, visual: <RsvpVisual /> },
  { icon: ScanLine, visual: <ScannerVisual /> },
  { icon: Images, visual: <GalleryVisual /> },
]

/** The four pillars, each with a small picture of the real feature and only what the app actually does. */
export function Features() {
  const { t } = useTranslation()
  const items = t('landing.features.items', { returnObjects: true }) as FeatureText[]

  return (
    <LandingSection id="features" labelledBy="features-title">
      <SectionHeading
        id="features-title"
        eyebrow={t('landing.features.eyebrow')}
        title={t('landing.features.title')}
        subtitle={t('landing.features.subtitle')}
      />
      <ul className="mt-14 grid gap-5 md:grid-cols-2">
        {items.map((item, index) => {
          const { icon: Icon, visual } = visuals[index] ?? visuals[0]!
          return (
            <li key={item.title}>
              <Reveal delay={(index % 2) * 90} className="h-full">
                <article className="flex h-full flex-col gap-6 rounded-3xl border border-brand-100 bg-white p-6 shadow-soft sm:p-8">
                  <div className="flex items-start gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-white shadow-primary">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <div>
                      <h3 className="font-display text-2xl font-semibold">{item.title}</h3>
                      <p className="mt-1.5 text-stone-600">{item.body}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-brand-50 p-4">{visual}</div>
                  <ul className="space-y-2">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm text-stone-700">
                        <Check
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-success-500"
                          strokeWidth={2.5}
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                  {item.note && (
                    <p className="mt-auto flex items-start gap-2 rounded-xl bg-gold-100/60 px-3 py-2.5 text-sm text-brand-950">
                      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
                      {item.note}
                    </p>
                  )}
                </article>
              </Reveal>
            </li>
          )
        })}
      </ul>
    </LandingSection>
  )
}
