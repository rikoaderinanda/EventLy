import {
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CircleCheck,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Gift,
  Images,
  type LucideIcon,
  MapPin,
  MessageCircleHeart,
  Music,
  Pencil,
  ScanLine,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { CoverPlaceholder } from '@/components/event/EventCard'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, EventStatusBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, SectionHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Feedback'
import { Loading } from '@/components/ui/Spinner'
import { useSession } from '@/features/auth/session-store'
import { EventPaymentSection } from '@/features/payments/EventPaymentSection'
import { useEventMedia } from '@/features/photos/api'
import { useUsers } from '@/features/users/api'
import { errorMessage } from '@/shared/lib/errors'
import {
  type EventDetail,
  isEditable,
  useAssignStaff,
  useDeleteEvent,
  useEvent,
  useEventAction,
  useEventStaff,
  useEventStats,
} from './api'
import { formatLocal, timeZoneLabel } from './format'

function Sessions({ event }: { event: EventDetail }) {
  const { t, i18n } = useTranslation()
  const tz = timeZoneLabel[event.timeZone]
  return (
    <ol className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[1.1875rem] before:w-px before:bg-brand-200">
      {event.sessions.map((s) => (
        <li key={s.id} className="relative flex gap-4">
          <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600">
            {s.isCheckInSession ? (
              <ScanLine aria-hidden className="size-4" />
            ) : (
              <Clock aria-hidden className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1 rounded-2xl border border-brand-100 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-brand-950">{s.name}</p>
              {s.isCheckInSession && (
                <Badge tone="brand" icon={ScanLine}>
                  {t('events.checkInSession')}
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-sm text-stone-600">
              {formatLocal(s.startsAtLocal, i18n.language)} –{' '}
              {formatLocal(s.endsAtLocal, i18n.language, false)} {tz}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
              <MapPin aria-hidden className="size-3.5 shrink-0 text-stone-400" />
              {s.venue}
            </p>
            {s.mapsUrl && (
              <a
                href={s.mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
              >
                {t('events.openMaps')}
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Owner only: pick which Staff members work at this event. */
function StaffAssignment({ event }: { event: EventDetail }) {
  const { t } = useTranslation()
  const members = useUsers()
  const assigned = useEventStaff(event.id, true)
  const save = useAssignStaff(event.id)
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const staff = (members.data ?? []).filter((u) => u.role === 'Staff' && u.status !== 'Disabled')
  const current = selected ?? new Set((assigned.data ?? []).map((s) => s.userId))

  function toggle(userId: string) {
    const next = new Set(current)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setSelected(next)
  }

  return (
    <Card as="section">
      <SectionHeader title={t('events.staffTitle')} description={t('events.staffHint')} level={3} />
      {staff.length === 0 && members.isSuccess && (
        <p className="text-sm text-stone-500">
          {t('events.noStaff')}{' '}
          <Link to="/app/users" className="font-medium text-brand-700 underline">
            {t('nav.users')}
          </Link>
        </p>
      )}
      <ul className="-mx-2 space-y-1">
        {staff.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-brand-50">
              <input
                type="checkbox"
                className="size-5 rounded accent-brand-600"
                checked={current.has(u.id)}
                onChange={() => toggle(u.id)}
              />
              <Avatar name={u.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-brand-950">{u.name}</span>
                <span className="block truncate text-xs text-stone-500">{u.email}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {save.isError && (
        <Notice tone="danger" className="mt-3">
          {errorMessage(t, save.error)}
        </Notice>
      )}
      {staff.length > 0 && (
        <Button
          variant="secondary"
          className="mt-4"
          loading={save.isPending}
          disabled={selected === null}
          onClick={() => save.mutate([...current], { onSuccess: () => setSelected(null) })}
        >
          {t('events.saveStaff')}
        </Button>
      )}
    </Card>
  )
}

function Actions({ event }: { event: EventDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const role = useSession((s) => s.user?.role)
  const cancel = useEventAction(event.id, 'cancel')
  const complete = useEventAction(event.id, 'complete')
  const remove = useDeleteEvent(event.id)
  const error = cancel.error ?? complete.error ?? remove.error

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {isEditable(event.status) && (
          <ButtonLink to={`/app/events/${event.id}/edit`} variant="secondary" size="sm" icon={Pencil}>
            {t('events.edit')}
          </ButtonLink>
        )}
        {event.status === 'Active' && (
          <Button
            variant="secondary"
            size="sm"
            icon={CalendarCheck}
            loading={complete.isPending}
            onClick={() => complete.mutate()}
          >
            {t('events.complete')}
          </Button>
        )}
        {role === 'Owner' && isEditable(event.status) && (
          <Button
            variant="ghost"
            size="sm"
            icon={XCircle}
            className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
            onClick={() => window.confirm(t('events.confirmCancel')) && cancel.mutate()}
          >
            {t('events.cancel')}
          </Button>
        )}
        {(event.status === 'Draft' || event.status === 'Cancelled') && (
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
            onClick={() =>
              window.confirm(t('events.confirmDelete')) &&
              remove.mutate(undefined, { onSuccess: () => navigate('/app/events', { replace: true }) })
            }
          >
            {t('events.delete')}
          </Button>
        )}
      </div>
      {error && <Notice tone="danger">{errorMessage(t, error)}</Notice>}
    </div>
  )
}

type MenuEntry = { to: string; title: string; detail: string | null; icon: LucideIcon; tone: string }

/** The event's sections as a grid of tiles: icon, name and its current number. */
function SectionGrid({ event }: { event: EventDetail }) {
  const { t } = useTranslation()
  const stats = useEventStats(event.id).data
  const n = (value: number | undefined, key: string) =>
    value === undefined ? null : t(key, { count: value })
  const entries: MenuEntry[] = [
    {
      to: 'guests',
      title: t('guests.title'),
      detail: n(stats?.guests.people, 'events.tile.invited'),
      icon: Users,
      tone: 'bg-brand-100 text-brand-700',
    },
    {
      to: 'rsvps',
      title: t('responses.rsvpTitle'),
      detail: stats
        ? t('events.tile.answered', { count: stats.rsvp.attending + stats.rsvp.notAttending })
        : null,
      icon: CircleCheck,
      tone: 'bg-success-50 text-success-700',
    },
    {
      to: 'wishes',
      title: t('responses.wishesTitle'),
      detail: n(stats?.wishes, 'events.tile.wishes'),
      icon: MessageCircleHeart,
      tone: 'bg-rose-50 text-rose-800',
    },
    {
      to: 'gifts',
      title: t('responses.giftsTitle'),
      detail: n(stats?.gifts.confirmations, 'events.tile.gifts'),
      icon: Gift,
      tone: 'bg-gold-100 text-gold-700',
    },
    {
      to: 'check-ins',
      title: t('checkin.logTitle'),
      detail: n(stats?.checkIns.people, 'events.tile.checkedIn'),
      icon: ScanLine,
      tone: 'bg-sky-50 text-sky-800',
    },
    {
      to: 'gallery',
      title: t('photos.galleryTitle'),
      detail: n(stats?.photos.count, 'events.tile.photos'),
      icon: Images,
      tone: 'bg-violet-50 text-violet-800',
    },
    {
      to: 'media',
      title: t('media.title'),
      detail: t('events.tile.media'),
      icon: Music,
      tone: 'bg-brand-100 text-brand-700',
    },
    {
      to: 'payments',
      title: t('nav.payments'),
      detail: event.package ? event.package.name : t('events.tile.unpaid'),
      icon: CreditCard,
      tone: 'bg-stone-100 text-stone-700',
    },
    {
      to: 'stats',
      title: t('nav.analytics'),
      detail: t('events.tile.stats'),
      icon: BarChart3,
      tone: 'bg-brand-100 text-brand-700',
    },
    {
      to: 'reports',
      title: t('nav.reports'),
      detail: t('events.tile.reports'),
      icon: FileSpreadsheet,
      tone: 'bg-success-50 text-success-700',
    },
  ]
  return (
    <nav aria-label={t('events.sectionsNav')}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.to}>
            <Link
              to={`/app/events/${event.id}/${entry.to}`}
              className="flex h-full flex-col gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift active:scale-[0.98]"
            >
              <span className={cn('flex size-10 items-center justify-center rounded-xl', entry.tone)}>
                <entry.icon aria-hidden className="size-5" />
              </span>
              <span>
                <span className="block font-semibold text-brand-950">{entry.title}</span>
                {entry.detail !== null && (
                  <span className="mt-0.5 block text-sm text-stone-500">{entry.detail}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function EventDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const role = useSession((s) => s.user?.role)
  const { data: event, isPending, isError, error } = useEvent(id)
  const cover = useEventMedia(id).data?.coverUrl

  if (isPending) return <Loading className="py-20" />
  if (isError)
    return (
      <Notice tone="danger" className="mx-auto mt-8 max-w-3xl">
        {errorMessage(t, error)}
      </Notice>
    )

  return (
    <section className="mx-auto max-w-5xl space-y-8 py-6 sm:py-10">
      <ButtonLink to="/app/events" variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3">
        {t('events.title')}
      </ButtonLink>

      <header className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
        <div className="relative aspect-[3/1] min-h-36">
          {cover ? (
            <img src={cover} alt="" className="size-full object-cover" />
          ) : (
            <CoverPlaceholder category={event.category} className="relative size-full" />
          )}
        </div>
        <div className="space-y-4 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            <Badge>{t(`events.category.${event.category}`)}</Badge>
            <Badge>{timeZoneLabel[event.timeZone]}</Badge>
          </div>
          <h1 className="text-page-responsive">{event.name}</h1>
          {event.description && (
            <p className="max-w-2xl text-body whitespace-pre-line text-stone-600">{event.description}</p>
          )}
          <Actions event={event} />
        </div>
      </header>

      <SectionGrid event={event} />

      <section>
        <SectionHeader title={t('events.sessions')} />
        <Sessions event={event} />
      </section>

      {event.status !== 'Cancelled' && (
        <Card as="section">
          <EventPaymentSection event={event} />
        </Card>
      )}

      {role === 'Owner' && <StaffAssignment event={event} />}
    </section>
  )
}
