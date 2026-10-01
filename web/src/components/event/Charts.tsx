import { CircleCheck, CircleDashed, CircleX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/components/ui/cn'

/**
 * RSVP answers as one stacked bar with a legend. Status colours (attending green, not attending red,
 * no answer grey) always come with an icon and a number, so nothing relies on colour alone.
 */
export function RsvpBreakdown({
  attending,
  notAttending,
  pending,
}: {
  attending: number
  notAttending: number
  pending: number
}) {
  const { t } = useTranslation()
  const total = attending + notAttending + pending
  const parts = [
    { key: 'Attending', value: attending, bar: 'bg-success-500', icon: CircleCheck, ink: 'text-success-700' },
    { key: 'NotAttending', value: notAttending, bar: 'bg-danger-500', icon: CircleX, ink: 'text-danger-700' },
    { key: 'Pending', value: pending, bar: 'bg-stone-300', icon: CircleDashed, ink: 'text-stone-500' },
  ]
  return (
    <div>
      {/* 2px surface gaps between segments; the bar itself is decorative, the legend carries the numbers. */}
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-brand-100">
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <span
                key={p.key}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', p.bar)}
                style={{ width: `${(p.value / total) * 100}%` }}
                title={`${t(`responses.status.${p.key}`)}: ${p.value}`}
              />
            ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {parts.map((p) => (
          <div key={p.key}>
            <dt className={cn('flex items-center gap-1.5 text-xs font-medium', p.ink)}>
              <p.icon aria-hidden className="size-3.5" />
              {t(`responses.status.${p.key}`)}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-brand-950 tabular-nums">
              {p.value}
              {total > 0 && (
                <span className="ml-1 text-xs font-normal text-stone-500">
                  {Math.round((p.value / total) * 100)}%
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * People checked in per hour, in the event's time zone. One series, one hue; the hovered (or focused)
 * bar shows its value, and a visually hidden table gives the same data to screen readers.
 */
export function CheckInChart({
  byHour,
  timeZone,
}: {
  byHour: { hour: string; people: number }[]
  timeZone: string
}) {
  const { t, i18n } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...byHour.map((h) => h.people))
  const label = (hour: string) =>
    new Intl.DateTimeFormat(i18n.language, { timeZone, hour: '2-digit', minute: '2-digit' }).format(
      new Date(hour),
    )

  if (byHour.length === 0)
    return <p className="py-8 text-center text-sm text-stone-500">{t('stats.noCheckIns')}</p>

  return (
    <figure>
      <div aria-hidden className="relative">
        <div className="flex h-44 items-end gap-1.5 border-b border-brand-100">
          {byHour.map((h, index) => (
            <div
              key={h.hour}
              className="relative flex h-full flex-1 items-end justify-center"
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
            >
              {active === index && (
                <span className="absolute -top-1 z-10 -translate-y-full rounded-lg bg-brand-950 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lift">
                  {label(h.hour)} · {t('stats.peopleCount', { count: h.people })}
                </span>
              )}
              <span
                className={cn(
                  'w-full max-w-10 rounded-t transition-colors',
                  active === index ? 'bg-brand-800' : 'bg-brand-500',
                )}
                style={{ height: `${Math.max(3, (h.people / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {byHour.map((h, index) => (
            <span
              key={h.hour}
              className="flex-1 truncate text-center text-[0.6875rem] text-stone-500 tabular-nums"
            >
              {/* Every other label when the hours are many, so they never collide. */}
              {byHour.length <= 8 || index % 2 === 0 ? label(h.hour) : ''}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{t('stats.checkInsByHour')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('stats.hour')}</th>
            <th scope="col">{t('stats.people')}</th>
          </tr>
        </thead>
        <tbody>
          {byHour.map((h) => (
            <tr key={h.hour}>
              <td>{label(h.hour)}</td>
              <td>{h.people}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
