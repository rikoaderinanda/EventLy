import {
  BarChart3,
  CalendarDays,
  Check,
  CircleCheck,
  LayoutDashboard,
  MessageCircleHeart,
  ScanLine,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatisticCard } from '@/components/event/StatisticCard'
import { MiniBars, ProgressRing } from '@/components/ui/Feedback'
import { Reveal } from '@/components/ui/Reveal'
import { LandingSection, SectionHeading } from './Section'

/**
 * A browser-framed picture of the organizer dashboard, built from the app's own components with fictional
 * numbers (and labelled as such), so it never reads as a usage claim.
 */
export function DashboardPreview() {
  const { t } = useTranslation()
  const points = t('landing.dashboard.points', { returnObjects: true }) as string[]

  return (
    <LandingSection labelledBy="dashboard-title">
      <SectionHeading
        id="dashboard-title"
        eyebrow={t('landing.dashboard.eyebrow')}
        title={t('landing.dashboard.title')}
        subtitle={t('landing.dashboard.subtitle')}
      />
      <Reveal className="mt-12">
        <figure>
          <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-lift">
            <div
              aria-hidden
              className="flex items-center gap-1.5 border-b border-brand-100 bg-brand-50/70 px-4 py-3"
            >
              <span className="size-2.5 rounded-full bg-danger-500/60" />
              <span className="size-2.5 rounded-full bg-warning-500/60" />
              <span className="size-2.5 rounded-full bg-success-500/60" />
              <span className="ml-3 h-5 flex-1 rounded-full bg-white ring-1 ring-brand-100 sm:max-w-sm" />
            </div>
            <div className="flex">
              <div
                aria-hidden
                className="hidden w-48 shrink-0 space-y-1 border-r border-brand-100 bg-brand-100/30 p-3 md:block"
              >
                {[LayoutDashboard, CalendarDays, Users, ScanLine, BarChart3].map((Icon, i) => (
                  <span
                    key={i}
                    className={`flex h-9 items-center gap-2.5 rounded-xl px-3 ${i === 0 ? 'bg-white shadow-soft' : ''}`}
                  >
                    <Icon className={`size-4 ${i === 0 ? 'text-brand-600' : 'text-stone-400'}`} />
                    <span
                      className={`h-2 rounded-full ${i === 0 ? 'w-20 bg-brand-300' : 'w-16 bg-stone-200'}`}
                    />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1 space-y-5 p-4 sm:p-6">
                <div>
                  <p className="font-display text-2xl font-semibold text-brand-950">
                    {t('landing.dashboard.greeting')} 👋
                  </p>
                  <p className="text-sm text-stone-500">{t('landing.dashboard.event')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatisticCard
                    icon={Users}
                    label={t('landing.dashboard.guests')}
                    value="250"
                    caption={t('landing.dashboard.ofQuota')}
                  />
                  <StatisticCard
                    icon={CircleCheck}
                    label={t('landing.dashboard.rsvp')}
                    value="182"
                    caption={t('landing.dashboard.attending')}
                    visual={
                      <ProgressRing
                        value={182}
                        max={250}
                        label={t('landing.dashboard.rsvp')}
                        size={48}
                        stroke={6}
                      />
                    }
                  />
                  <StatisticCard
                    icon={ScanLine}
                    label={t('landing.dashboard.checkin')}
                    value="96"
                    tone="success"
                    caption={t('landing.dashboard.ofPeople')}
                    visual={<MiniBars values={[4, 9, 18, 30, 24, 11]} className="w-14" />}
                  />
                  <StatisticCard
                    icon={MessageCircleHeart}
                    label={t('landing.dashboard.wishes')}
                    value="34"
                    tone="gold"
                  />
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-center text-xs text-stone-500">
            {t('landing.dashboard.sample')}
          </figcaption>
        </figure>
      </Reveal>
      <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-stone-700">
        {points.map((point) => (
          <li key={point} className="inline-flex items-center gap-1.5">
            <Check aria-hidden className="size-4 text-success-500" strokeWidth={2.5} />
            {point}
          </li>
        ))}
      </ul>
    </LandingSection>
  )
}
