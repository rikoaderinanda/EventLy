import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { isEditable, useEvent } from '@/features/events/api'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import {
  useGuests,
  useSaveWhatsAppTemplate,
  useWhatsAppTemplate,
  type GuestFilter,
  type GuestType,
  type InvitationStatus,
} from './api'
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
    <details className="rounded-lg border border-brand-100 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium text-brand-900">{t('guests.templateTitle')}</summary>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <p className="text-stone-600">{t('guests.templateHint')}</p>
        <label htmlFor="whatsapp-template" className="sr-only">
          {t('guests.templateTitle')}
        </label>
        <textarea
          id="whatsapp-template"
          rows={6}
          maxLength={1000}
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="w-full rounded-md border border-stone-300 px-3 py-2 aria-invalid:border-red-500"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {save.isError && !error && <p className="text-xs text-red-600">{errorMessage(t, save.error)}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={save.isPending || draft === null}
            className="rounded-md bg-brand-700 px-3 py-1.5 font-medium text-white disabled:opacity-50"
          >
            {t('common.save')}
          </button>
          {template.data && !template.data.isDefault && (
            <button
              type="button"
              onClick={() => save.mutate(null, { onSuccess: () => setDraft(null) })}
              className="px-3 py-1.5 text-stone-600 underline"
            >
              {t('guests.templateReset')}
            </button>
          )}
        </div>
      </form>
    </details>
  )
}

/** Owner/Admin: the guests of an event, each with their invitation link. */
export function GuestListPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const [filter, setFilter] = useState<GuestFilter>({ search: '', type: '', status: '' })
  const guests = useGuests(id, filter)
  const editable = event.data ? isEditable(event.data.status) : false
  const list = guests.data
  // The package limit counts people: a group takes a place per person.
  const full = list?.limit != null && list.totalPeople >= list.limit

  return (
    <section className="mx-auto max-w-4xl space-y-4 py-8">
      <div>
        <Link to={`/app/events/${id}`} className="text-sm text-brand-700 underline">
          ← {event.data?.name ?? t('events.title')}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-brand-900">{t('guests.title')}</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/app/events/${id}/qr-sheet`}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700"
            >
              {t('guests.qrSheet')}
            </Link>
            {editable && !full && (
              <Link
                to={`/app/events/${id}/guests/new`}
                className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white"
              >
                {t('guests.add')}
              </Link>
            )}
          </div>
        </div>
        {list && (
          <p className="mt-1 text-sm text-stone-600">
            {list.limit != null
              ? t('guests.countWithLimit', { total: list.total, limit: list.limit, people: list.totalPeople })
              : t('guests.count', { total: list.total, people: list.totalPeople })}
          </p>
        )}
        {full && <p className="mt-1 text-sm text-amber-800">{t('guests.full')}</p>}
        {event.data && event.data.status !== 'Active' && editable && (
          <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{t('guests.notActiveYet')}</p>
        )}
      </div>

      {editable && <TemplateEditor eventId={id} />}

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder={t('guests.search')}
          aria-label={t('guests.search')}
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2"
        />
        <select
          aria-label={t('guests.typeLabel')}
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value as GuestType | '' })}
          className="rounded-md border border-stone-300 bg-white px-3 py-2"
        >
          <option value="">{t('guests.allTypes')}</option>
          <option value="Individual">{t('guests.type.Individual')}</option>
          <option value="Group">{t('guests.type.Group')}</option>
        </select>
        <select
          aria-label={t('guests.statusLabel')}
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value as InvitationStatus | '' })}
          className="rounded-md border border-stone-300 bg-white px-3 py-2"
        >
          <option value="">{t('guests.allStatuses')}</option>
          <option value="Active">{t('guests.status.Active')}</option>
          <option value="Revoked">{t('guests.status.Revoked')}</option>
        </select>
      </div>

      {guests.isError && <p className="text-red-700">{errorMessage(t, guests.error)}</p>}
      {list && list.total === 0 && (
        <div className="rounded-lg border border-dashed border-brand-200 bg-white p-8 text-center text-stone-600">
          {t('guests.empty')}
        </div>
      )}
      <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4 empty:hidden">
        {list?.guests.map((guest) => (
          <li key={guest.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <Link
                to={`/app/events/${id}/guests/${guest.id}`}
                className="block truncate font-medium text-brand-800 underline"
              >
                {guest.name}
              </Link>
              <p className="text-sm text-stone-500">
                {guest.guestType === 'Group'
                  ? t('guests.groupOf', { n: guest.numberOfPeople })
                  : t('guests.type.Individual')}
                {guest.phone && ` · ${guest.phone}`}
              </p>
            </div>
            <InvitationActions invitation={guest.invitation} />
          </li>
        ))}
      </ul>
    </section>
  )
}
