import { CalendarDays, Check, ChevronsUpDown, Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { matchPath, useLocation, useNavigate } from 'react-router'
import { EventStatusBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Loading } from '@/components/ui/Spinner'
import { formatEventDate } from '@/features/events/format'
import { useSelectedEvent } from '@/features/events/selected-event'
import { EventPickerContext, useEventPicker } from './eventPickerContext'

/** Holds the one event-picker dialog of the organizer area. */
export function EventPickerProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { events, isLoading, selected, select } = useSelectedEvent()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<string | undefined>()

  function choose(eventId: string) {
    select(eventId)
    setOpen(false)
    // Stay on the same kind of page when switching events (guests of A → guests of B).
    const current = matchPath('/app/events/:id/:page/*', pathname)
    const target = page ?? current?.params.page
    if (target) navigate(`/app/events/${eventId}/${target}`)
  }

  return (
    <EventPickerContext
      value={{
        openPicker: (next) => {
          setPage(next)
          setOpen(true)
        },
      }}
    >
      {children}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('eventPicker.title')}
        description={t('eventPicker.description')}
        footer={
          <ButtonLink
            to="/app/events/new"
            variant="secondary"
            icon={Plus}
            block="mobile"
            onClick={() => setOpen(false)}
          >
            {t('eventPicker.create')}
          </ButtonLink>
        }
      >
        {isLoading ? (
          <Loading />
        ) : events.length === 0 ? (
          <EmptyState kind="events" title={t('eventPicker.empty')} className="py-4" />
        ) : (
          <ul className="-mx-2 space-y-1 pb-2">
            {events.map((event) => {
              const current = event.id === selected?.id
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    aria-current={current || undefined}
                    onClick={() => choose(event.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                      current ? 'bg-brand-100/80' : 'hover:bg-brand-50',
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                      <CalendarDays aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-brand-950">{event.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">
                        {formatEventDate(event.date, event.timeZone, i18n.language)}
                      </span>
                    </span>
                    <EventStatusBadge status={event.status} />
                    {current && <Check aria-hidden className="size-4 shrink-0 text-brand-600" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>
    </EventPickerContext>
  )
}

/** The button showing the selected event; opens the picker. */
export function EventPickerButton({
  compact,
  slim,
  className,
}: {
  /** Icon only (collapsed sidebar). */
  compact?: boolean
  /** One line for the phone header. */
  slim?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { openPicker } = useEventPicker()
  const { selected, isLoading } = useSelectedEvent()
  const label = selected?.name ?? (isLoading ? t('common.loading') : t('eventPicker.none'))

  if (compact)
    return (
      <button
        type="button"
        onClick={() => openPicker()}
        aria-label={t('eventPicker.change', { name: label })}
        title={label}
        className={cn(
          'flex size-11 items-center justify-center rounded-xl border border-brand-100 bg-white text-brand-700 shadow-soft hover:border-brand-200',
          className,
        )}
      >
        <CalendarDays aria-hidden className="size-5" />
      </button>
    )

  if (slim)
    return (
      <button
        type="button"
        onClick={() => openPicker()}
        aria-label={t('eventPicker.change', { name: label })}
        className={cn(
          'flex h-11 w-full min-w-0 items-center gap-2 rounded-full bg-white/80 px-4 text-left ring-1 ring-brand-100 transition-colors hover:ring-brand-200',
          className,
        )}
      >
        <CalendarDays aria-hidden className="size-4 shrink-0 text-brand-600" />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium',
            selected ? 'text-brand-950' : 'text-stone-500',
          )}
        >
          {label}
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-stone-400" />
      </button>
    )

  return (
    <button
      type="button"
      onClick={() => openPicker()}
      aria-label={t('eventPicker.change', { name: label })}
      className={cn(
        'flex w-full min-w-0 items-center gap-3 rounded-xl border border-brand-100 bg-white px-3 py-2 text-left shadow-soft transition-colors hover:border-brand-200',
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        <CalendarDays aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.6875rem] font-medium tracking-wide text-stone-500 uppercase">
          {t('nav.selectedEvent')}
        </span>
        <span
          className={cn('block truncate text-sm font-medium', selected ? 'text-brand-950' : 'text-stone-500')}
        >
          {label}
        </span>
      </span>
      <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-stone-400" />
    </button>
  )
}
