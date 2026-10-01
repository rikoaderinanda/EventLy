import { ArrowRight, Check, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { formatMoney } from '@/features/payments/api'
import { landingPackages, type LandingPackage } from './packages'
import { LandingSection, SectionHeading } from './Section'

function useNumber() {
  const { i18n } = useTranslation()
  return (n: number) => n.toLocaleString(i18n.language)
}

function PackageCard({ pkg }: { pkg: LandingPackage }) {
  const { t, i18n } = useTranslation()
  const n = useNumber()
  const lines = [
    t('landing.pricing.guests', { n: n(pkg.guests) }),
    t('landing.pricing.photos', { n: n(pkg.photos) }),
    t('landing.pricing.staff', { n: n(pkg.staff) }),
    t('landing.pricing.admins', { n: n(pkg.admins) }),
    t('landing.pricing.retention', { n: n(pkg.retentionDays) }),
    pkg.zip ? t('landing.pricing.zip') : null,
    pkg.guestPhotos > 0 ? t('landing.pricing.guestCamera', { n: pkg.guestPhotos }) : null,
    pkg.excel ? t('landing.pricing.excel') : t('landing.pricing.csv'),
  ].filter((line): line is string => line !== null)

  return (
    <article
      aria-labelledby={`plan-${pkg.code}`}
      className="flex h-full flex-col rounded-3xl border border-brand-100 bg-white p-6 shadow-soft sm:p-8"
    >
      <h3 id={`plan-${pkg.code}`} className="font-display text-2xl font-semibold">
        {pkg.name}
      </h3>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight text-brand-950 tabular-nums">
          {formatMoney(pkg.price, 'IDR', i18n.language)}
        </span>
        <span className="text-sm text-stone-500">{t('landing.pricing.perEvent')}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-sm text-stone-700">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-500" strokeWidth={2.5} />
            {line}
          </li>
        ))}
      </ul>
      <ButtonLink to="/login" variant="secondary" block iconRight={ArrowRight} className="mt-8">
        {t('landing.pricing.choose', { name: pkg.name })}
      </ButtonLink>
    </article>
  )
}

function Yes({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center text-success-700">
      <Check aria-hidden className="size-5" strokeWidth={2.5} />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function No({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center text-stone-400">
      <Minus aria-hidden className="size-5" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Every limit side by side; the first column stays in view when the table scrolls on a phone. */
function Comparison() {
  const { t } = useTranslation()
  const n = useNumber()
  const yes = t('landing.pricing.yes')
  const no = t('landing.pricing.no')
  const rows: { key: string; cell: (p: LandingPackage) => React.ReactNode }[] = [
    { key: 'guests', cell: (p) => n(p.guests) },
    { key: 'photos', cell: (p) => n(p.photos) },
    { key: 'staff', cell: (p) => n(p.staff) },
    { key: 'admins', cell: (p) => n(p.admins) },
    { key: 'storage', cell: (p) => t('landing.pricing.days', { n: n(p.retentionDays) }) },
    { key: 'zip', cell: (p) => (p.zip ? <Yes label={yes} /> : <No label={no} />) },
    {
      key: 'camera',
      cell: (p) =>
        p.guestPhotos > 0 ? t('landing.pricing.perInvitation', { n: p.guestPhotos }) : <No label={no} />,
    },
    { key: 'reports', cell: (p) => (p.excel ? 'CSV + Excel' : 'CSV') },
  ]

  return (
    <Reveal className="mt-14">
      <h3 id="compare-title" className="text-center font-display text-2xl font-semibold">
        {t('landing.pricing.compareTitle')}
      </h3>
      <div className="mt-6 overflow-x-auto rounded-3xl border border-brand-100 bg-white shadow-soft">
        <table aria-labelledby="compare-title" className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-brand-100 bg-brand-50/70">
              <th
                scope="col"
                className="sticky left-0 bg-brand-50 px-5 py-4 text-left font-medium text-stone-500"
              >
                {t('landing.pricing.feature')}
              </th>
              {landingPackages.map((p) => (
                <th
                  key={p.code}
                  scope="col"
                  className="px-5 py-4 text-center font-display text-base font-semibold text-brand-950"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="sticky left-0 bg-white px-5 py-3.5 text-left font-medium text-stone-700"
                >
                  {t(`landing.pricing.rows.${row.key}`)}
                </th>
                {landingPackages.map((p) => (
                  <td key={p.code} className="px-5 py-3.5 text-center text-stone-700 tabular-nums">
                    {row.cell(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  )
}

/** Three packages of equal weight (no "most popular" nudge), then the full comparison. */
export function Pricing() {
  const { t } = useTranslation()
  return (
    <LandingSection id="pricing" labelledBy="pricing-title">
      <SectionHeading
        id="pricing-title"
        eyebrow={t('landing.pricing.eyebrow')}
        title={t('landing.pricing.title')}
        subtitle={t('landing.pricing.subtitle')}
      />
      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {landingPackages.map((pkg, index) => (
          <li key={pkg.code}>
            <Reveal delay={index * 90} className="h-full">
              <PackageCard pkg={pkg} />
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-stone-500">{t('landing.pricing.fine')}</p>
      <Comparison />
    </LandingSection>
  )
}
