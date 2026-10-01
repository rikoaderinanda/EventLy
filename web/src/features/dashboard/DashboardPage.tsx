import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  MapPin,
  MessageCircleHeart,
  ScanLine,
  type LucideIcon,
  Users,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CoverPlaceholder } from '@/components/event/EventCard'
import { StatisticCard } from '@/components/event/StatisticCard'
import { EventStatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, SectionHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { MiniBars, Notice, ProgressBar, ProgressRing } from '@/components/ui/Feedback'
import { Skeleton } from '@/components/ui/Spinner'
import { useSession } from '@/features/auth/session-store'
import { type EventListItem, useEventStats } from '@/features/events/api'
import { formatEventDate } from '@/features/events/format'
import { EventListCard } from '@/features/events/EventListCard'
import { useSelectedEvent } from '@/features/events/selected-event'
import { errorMessage } from '@/shared/lib/errors'

const day = 24 * 60 * 60 * 1000

/** The event the dashboard is about: the selected one, else the next upcoming, else the latest. */
function heroOf(events: EventListItem[], selected: EventListItem | null, now: number) {
  if (selected && selected.status !== 'Cancelled') return selected
  const live = events.filter((e) => e.status !== 'Cancelled')
  const upcoming = live
    .filter((e) => new Date(e.date).getTime() >= now - day)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
  return upcoming[0] ?? live[0] ?? null
}

function HeroEvent({ event }: { event: EventListItem }) {
  const { t, i18n } = useTranslation()
  const { counts } = event
  return (
    <Link
      to={`/app/events/${event.id}`}
      className="group relative block overflow-hidden rounded-3xl bg-brand-950 shadow-lift"
    >
      <div className="relative aspect-square min-[480px]:aspect-[4/3] sm:aspect-[21/9]">
        {event.coverUrl ? (
          <img
            src={event.coverUrl}
            alt=""
            className="size-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.02]"
          />
        ) : (
          <CoverPlaceholder category={event.category} className="relative size-full" />
        )}
        {/* Dark gradient so the white text stays readable on any photo. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-brand-950/90 via-brand-950/40 to-transparent"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/90">
            <EventStatusBadge status={event.status} />
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
            {t(`events.category.${event.category}`)}
          </span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">{event.name}</h2>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4" />
            {formatEventDate(event.date, event.timeZone, i18n.language)}
          </span>
          {event.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4" />
              {event.venue}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden className="size-4" />
            {t('ui.event.guests', { count: counts.people })}
          </span>
        </p>
        {counts.invitations > 0 && (
          <div className="mt-4 max-w-sm space-y-1.5">
            <div className="flex justify-between text-xs text-white/80">
              <span>{t('ui.event.rsvpProgress')}</span>
              <span className="font-medium text-white">
                {counts.rsvpAnswered}/{counts.invitations}
              </span>
            </div>
            <ProgressBar
              value={counts.rsvpAnswered}
              max={counts.invitations}
              label={t('ui.event.rsvpProgress')}
              className="bg-white/20"
            />
          </div>
        )}
      </div>
    </Link>
  )
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2.5 rounded-2xl border border-brand-100 bg-white px-2 py-4 text-center shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift active:scale-[0.98] sm:flex-row sm:px-4 sm:text-left"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="text-sm font-medium text-brand-950">{label}</span>
    </Link>
  )
}

function Metrics({ event }: { event: EventListItem }) {
  const { t } = useTranslation()
  const stats = useEventStats(event.id)
  if (stats.isPending)
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    )
  if (stats.isError) return <Notice tone="danger">{errorMessage(t, stats.error)}</Notice>
  const { guests, rsvp, checkIns, wishes } = stats.data
  const answered = rsvp.attending + rsvp.notAttending
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatisticCard
        icon={Users}
        label={t('dashboard.totalGuests')}
        value={guests.people}
        caption={
          guests.peopleLimit
            ? t('dashboard.ofLimit', { limit: guests.peopleLimit })
            : t('dashboard.invitations', { count: guests.invitations })
        }
      />
      <StatisticCard
        icon={CircleCheck}
        label={t('dashboard.rsvp')}
        value={answered}
        caption={t('dashboard.attendingPeople', { count: rsvp.attendingPeople })}
        visual={
          <ProgressRing
            value={answered}
            max={guests.invitations}
            label={t('ui.event.rsvpProgress')}
            size={52}
            stroke={6}
          />
        }
      />
      <StatisticCard
        icon={ScanLine}
        label={t('dashboard.checkedIn')}
        value={checkIns.people}
        tone="success"
        caption={t('dashboard.ofPeople', { count: guests.people })}
        visual={
          checkIns.byHour.length > 1 ? (
            <MiniBars values={checkIns.byHour.slice(-8).map((h) => h.people)} className="w-14" />
          ) : undefined
        }
      />
      <StatisticCard icon={MessageCircleHeart} label={t('dashboard.wishes')} value={wishes} tone="gold" />
    </div>
  )
}

/** Organizer home (Owner/Admin): greeting, the event in focus, quick actions and its numbers. */
export function DashboardPage() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const role = user?.role
  const { events, isLoading, selected } = useSelectedEvent()
  // The moment the page opened: "this week" and "upcoming" don't need to tick while it is open.
  const [now] = useState(() => Date.now())
  const hero = heroOf(events, selected, now)
  const thisWeek = events.filter(
    (e) => e.status === 'Active' && Math.abs(new Date(e.date).getTime() - now) <= 7 * day,
  ).length
  const others = events.filter((e) => e.id !== hero?.id && e.status !== 'Cancelled').slice(0, 3)
  const firstName = user?.name.split(/\s+/)[0] ?? ''

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6 sm:space-y-10 sm:py-10">
      <header>
        <h1 className="text-page-responsive">{t('dashboard.greeting', { name: firstName })} 👋</h1>
        <p className="mt-2 text-body text-stone-500">
          {isLoading
            ? t('common.loading')
            : thisWeek > 0
              ? t('dashboard.activeThisWeek', { count: thisWeek })
              : events.length > 0
                ? t('dashboard.noneThisWeek')
                : t('dashboard.welcome')}
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="aspect-square rounded-3xl min-[480px]:aspect-[4/3] sm:aspect-[21/9]" />
      ) : hero ? (
        <HeroEvent event={hero} />
      ) : (
        <Card>
          <EmptyState
            kind="events"
            title={t('events.emptyTitle')}
            description={t('events.emptyBody')}
            action={
              <ButtonLink to="/app/events/new" icon={CalendarPlus}>
                {t('events.create')}
              </ButtonLink>
            }
          />
        </Card>
      )}

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="sr-only">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <QuickAction to="/app/events/new" icon={CalendarPlus} label={t('dashboard.addEvent')} />
          {hero && (
            <>
              <QuickAction
                to={`/app/events/${hero.id}/guests`}
                icon={UserPlus}
                label={t('dashboard.manageGuests')}
              />
              <QuickAction
                to={role === 'Owner' ? `/staff/events/${hero.id}` : `/app/events/${hero.id}/check-ins`}
                icon={ScanLine}
                label={t('dashboard.scan')}
              />
              <QuickAction
                to={`/app/events/${hero.id}/stats`}
                icon={BarChart3}
                label={t('dashboard.viewStats')}
              />
            </>
          )}
        </div>
      </section>

      {hero && (
        <section>
          <SectionHeader
            title={t('dashboard.statsTitle')}
            description={hero.name}
            actions={
              <ButtonLink
                to={`/app/events/${hero.id}/stats`}
                variant="ghost"
                size="sm"
                iconRight={ArrowRight}
              >
                {t('dashboard.details')}
              </ButtonLink>
            }
          />
          <Metrics event={hero} />
        </section>
      )}

      {others.length > 0 && (
        <section>
          <SectionHeader
            title={t('dashboard.otherEvents')}
            actions={
              <ButtonLink to="/app/events" variant="ghost" size="sm" iconRight={ArrowRight}>
                {t('dashboard.allEvents')}
              </ButtonLink>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((e) => (
              <EventListCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
