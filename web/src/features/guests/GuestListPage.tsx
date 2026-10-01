import { ArrowLeft, MessageSquareText, QrCode, Search, UserPlus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { GuestCard } from '@/components/event/GuestCard'
import { Avatar } from '@/components/ui/Avatar'
import { CheckInBadge, RsvpBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice, ProgressBar } from '@/components/ui/Feedback'
import { TextArea } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Spinner'
import { ToolPanel } from '@/components/ui/ToolPanel'
import { useIsDesktop } from '@/components/ui/useIsDesktop'
import { isEditable, useEvent } from '@/features/events/api'
import type { RsvpStatus } from '@/features/invitation/api'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import {
  type Guest,
  type GuestFilter,
  type GuestType,
  type InvitationStatus,
  useGuests,
  useSaveWhatsAppTemplate,
  useWhatsAppTemplate,
} from './api'
import { GuestImport } from './GuestImport'
import { InvitationActions } from './InvitationActions'

/** The event's WhatsApp message, with {nama}, {acara} and {link}. */
function TemplateEditor({ eventId }: { eventId: string }) {
  const { t } = useTranslation()
  const template = useWhatsAppTemplate(eventId)
  const save = useSaveWhatsAppTemplate(eventId)
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? template.data?.template ?? ''
  const error = fieldErrors(save.error).template

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(text, { onSuccess: () => setDraft(null) })
  }

  return (
    <ToolPanel title={t('guests.templateTitle')} icon={MessageSquareText}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-stone-600">{t('guests.templateHint')}</p>
        <TextArea
          id="whatsapp-template"
          label={t('guests.templateTitle')}
          rows={6}
          maxLength={1000}
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          error={error}
        />
        {save.isError && !error && <Notice tone="danger">{errorMessage(t, save.error)}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" loading={save.isPending} disabled={draft === null}>
            {t('common.save')}
          </Button>
          {template.data && !template.data.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => save.mutate(null, { onSuccess: () => setDraft(null) })}
            >
              {t('guests.templateReset')}
            </Button>
          )}
        </div>
      </form>
    </ToolPanel>
  )
}

const filterSelect =
  'h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-700 hover:border-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none'

function typeLine(t: (key: string, options?: Record<string, unknown>) => string, guest: Guest) {
  return [
    guest.guestType === 'Group'
      ? t('guests.groupOf', { n: guest.numberOfPeople })
      : t('guests.type.Individual'),
    guest.phone,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Desktop: one table row per guest. */
function GuestTable({ eventId, guests }: { eventId: string; guests: Guest[] }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-brand-100 bg-brand-50/60 text-xs font-medium tracking-wide text-stone-500 uppercase">
          <tr>
            <th scope="col" className="px-5 py-3">
              {t('guests.column.guest')}
            </th>
            <th scope="col" className="px-3 py-3">
              {t('guests.column.rsvp')}
            </th>
            <th scope="col" className="px-3 py-3">
              {t('guests.column.checkIn')}
            </th>
            <th scope="col" className="px-5 py-3">
              {t('guests.column.invitation')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-100">
          {guests.map((guest) => (
            <tr key={guest.id} className="transition-colors hover:bg-brand-50/50">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={guest.name} size="sm" />
                  <div className="min-w-0">
                    <Link
                      to={`/app/events/${eventId}/guests/${guest.id}`}
                      className="block truncate font-medium text-brand-950 hover:text-brand-700 hover:underline"
                    >
                      {guest.name}
                    </Link>
                    <p className="truncate text-xs text-stone-500">{typeLine(t, guest)}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3.5">
                <RsvpBadge status={guest.rsvp} />
              </td>
              <td className="px-3 py-3.5">
                <CheckInBadge checkedInAt={guest.checkedInAt} />
              </td>
              <td className="px-5 py-3.5">
                <InvitationActions invitation={guest.invitation} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Owner/Admin: the guests of an event, each with their invitation link. */
export function GuestListPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const desktop = useIsDesktop()
  const event = useEvent(id)
  const [filter, setFilter] = useState<GuestFilter>({ search: '', type: '', status: '', rsvp: '' })
  const guests = useGuests(id, filter)
  const editable = event.data ? isEditable(event.data.status) : false
  const list = guests.data
  // The package limit counts people: a group takes a place per person.
  const full = list?.limit != null && list.totalPeople >= list.limit
  const filtered = filter.search !== '' || filter.type !== '' || filter.status !== '' || filter.rsvp !== ''

  return (
    <section className="mx-auto max-w-6xl space-y-5 py-6 sm:py-10">
      <ButtonLink to={`/app/events/${id}`} variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3">
        {event.data?.name ?? t('events.title')}
      </ButtonLink>

      <PageHeader
        className="mb-0 sm:mb-0"
        title={t('guests.title')}
        subtitle={
          list &&
          (list.limit != null
            ? t('guests.countWithLimit', { total: list.total, limit: list.limit, people: list.totalPeople })
            : t('guests.count', { total: list.total, people: list.totalPeople }))
        }
        actions={
          <>
            <ButtonLink to={`/app/events/${id}/qr-sheet`} variant="secondary" icon={QrCode}>
              {t('guests.qrSheet')}
            </ButtonLink>
            {editable && !full && (
              <ButtonLink to={`/app/events/${id}/guests/new`} icon={UserPlus} className="flex-1 sm:flex-none">
                {t('guests.add')}
              </ButtonLink>
            )}
          </>
        }
      />

      {list?.limit != null && (
        <ProgressBar
          value={list.totalPeople}
          max={list.limit}
          label={t('stats.quota')}
          className="max-w-md"
        />
      )}
      {full && <Notice tone="warning">{t('guests.full')}</Notice>}
      {event.data && event.data.status !== 'Active' && editable && (
        <Notice>{t('guests.notActiveYet')}</Notice>
      )}

      {editable && (
        <div className="grid gap-3 lg:grid-cols-2">
          <TemplateEditor eventId={id} />
          {!full && <GuestImport eventId={id} />}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('guests.search')}</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400"
          />
          <input
            type="search"
            placeholder={t('guests.search')}
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className={cn(filterSelect, 'w-full pl-10')}
          />
        </label>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <select
            aria-label={t('guests.typeLabel')}
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value as GuestType | '' })}
            className={filterSelect}
          >
            <option value="">{t('guests.allTypes')}</option>
            <option value="Individual">{t('guests.type.Individual')}</option>
            <option value="Group">{t('guests.type.Group')}</option>
          </select>
          <select
            aria-label={t('guests.statusLabel')}
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value as InvitationStatus | '' })}
            className={filterSelect}
          >
            <option value="">{t('guests.allStatuses')}</option>
            <option value="Active">{t('guests.status.Active')}</option>
            <option value="Revoked">{t('guests.status.Revoked')}</option>
          </select>
          <select
            aria-label={t('responses.filter')}
            value={filter.rsvp}
            onChange={(e) => setFilter({ ...filter, rsvp: e.target.value as RsvpStatus | '' })}
            className={filterSelect}
          >
            <option value="">{t('responses.allAnswers')}</option>
            {(['Attending', 'NotAttending', 'Pending'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`responses.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {guests.isError && <Notice tone="danger">{errorMessage(t, guests.error)}</Notice>}
      {guests.isPending && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}
      {list && list.guests.length === 0 && (
        <Card>
          <EmptyState
            kind="guests"
            title={filtered ? t('guests.noMatch') : t('guests.emptyTitle')}
            description={filtered ? undefined : t('guests.empty')}
            action={
              !filtered &&
              editable &&
              !full && (
                <ButtonLink to={`/app/events/${id}/guests/new`} icon={UserPlus}>
                  {t('guests.add')}
                </ButtonLink>
              )
            }
          />
        </Card>
      )}

      {list &&
        list.guests.length > 0 &&
        (desktop ? (
          <GuestTable eventId={id} guests={list.guests} />
        ) : (
          <ul className="space-y-3">
            {list.guests.map((guest) => (
              <li key={guest.id}>
                <GuestCard
                  to={`/app/events/${id}/guests/${guest.id}`}
                  name={guest.name}
                  people={guest.numberOfPeople}
                  rsvp={guest.rsvp}
                  checkedInAt={guest.checkedInAt}
                  detail={
                    [guest.guestType === 'Individual' ? t('guests.type.Individual') : null, guest.phone]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  actions={<InvitationActions invitation={guest.invitation} />}
                />
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
