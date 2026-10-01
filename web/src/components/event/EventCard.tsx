import { Briefcase, Cake, CalendarDays, Heart, MapPin, PartyPopper, Sparkles, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge, EventStatusBadge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'
import { ProgressBar } from '@/components/ui/Feedback'

const categoryLook: Record<string, { icon: typeof Heart; cover: string }> = {
  Wedding: { icon: Heart, cover: 'from-brand-200 via-brand-100 to-gold-100' },
  Birthday: { icon: Cake, cover: 'from-rose-100 via-amber-50 to-sky-100' },
  Corporate: { icon: Briefcase, cover: 'from-stone-300 via-stone-200 to-brand-100' },
  Community: { icon: Users, cover: 'from-success-100 via-brand-50 to-gold-100' },
  Other: { icon: PartyPopper, cover: 'from-brand-100 via-brand-50 to-brand-200' },
}

/** A soft gradient with the category icon, used until the Owner uploads a cover photo. */
export function CoverPlaceholder({ category, className }: { category: string; className?: string }) {
  const look = categoryLook[category] ?? categoryLook.Other!
  const Icon = look.icon
  return (
    <div
      aria-hidden
      className={cn('flex items-center justify-center bg-linear-to-br', look.cover, className)}
    >
      <Icon className="size-10 text-brand-600/40" strokeWidth={1.25} />
      <Sparkles className="absolute top-4 right-5 size-4 text-gold-500/60" />
    </div>
  )
}

export type EventCardProps = {
  to: string
  name: string
  category: string
  status: string
  /** Already formatted in the event's time zone. */
  date: string
  venue?: string | null
  coverUrl?: string | null
  /** People invited, when known. */
  guests?: number | null
  /** RSVP answered out of invitations, when known. */
  rsvp?: { answered: number; total: number } | null
  className?: string
}

/** One event in a list: cover, category, status, date, place, guest count and RSVP progress. */
export function EventCard({
  to,
  name,
  category,
  status,
  date,
  venue,
  coverUrl,
  guests,
  rsvp,
  className,
}: EventCardProps) {
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft',
        'transition-[box-shadow,transform,border-color] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift',
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder category={category} className="relative size-full" />
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <Badge tone="neutral" className="bg-white/90 ring-white/60 backdrop-blur">
            {t(`events.category.${category}`)}
          </Badge>
          <span className="rounded-full bg-white/90 backdrop-blur">
            <EventStatusBadge status={status} />
          </span>
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <h3 className="line-clamp-2 text-card text-brand-950 group-hover:text-brand-700">{name}</h3>
        <ul className="space-y-1.5 text-sm text-stone-600">
          <li className="flex items-center gap-2">
            <CalendarDays aria-hidden className="size-4 shrink-0 text-brand-500" />
            <span className="truncate">{date}</span>
          </li>
          {venue && (
            <li className="flex items-center gap-2">
              <MapPin aria-hidden className="size-4 shrink-0 text-brand-500" />
              <span className="truncate">{venue}</span>
            </li>
          )}
          {guests != null && (
            <li className="flex items-center gap-2">
              <Users aria-hidden className="size-4 shrink-0 text-brand-500" />
              {t('ui.event.guests', { count: guests })}
            </li>
          )}
        </ul>
        {rsvp && rsvp.total > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-stone-500">
              <span>{t('ui.event.rsvpProgress')}</span>
              <span className="font-medium text-stone-700">
                {rsvp.answered}/{rsvp.total}
              </span>
            </div>
            <ProgressBar value={rsvp.answered} max={rsvp.total} label={t('ui.event.rsvpProgress')} />
          </div>
        )}
      </div>
    </Link>
  )
}
