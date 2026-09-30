import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Field } from '@/shared/components/Field'
import { errorMessage } from '@/shared/lib/errors'
import {
  eventCategories,
  timeZones,
  useCreateEvent,
  useEvent,
  useUpdateEvent,
  type EventCategory,
  type EventDetail,
  type EventInput,
  type EventTimeZone,
  type SessionInput,
} from './api'
import { joinLocal, splitLocal, timeZoneLabel } from './format'

const maxSessions = 5

type SessionDraft = {
  key: string
  id: string | null
  name: string
  date: string
  startTime: string
  endTime: string
  venue: string
  mapsUrl: string
  isCheckInSession: boolean
}

let nextKey = 0
const newKey = () => `s${++nextKey}`

function emptySession(name: string, isCheckInSession: boolean): SessionDraft {
  return {
    key: newKey(),
    id: null,
    name,
    date: '',
    startTime: '',
    endTime: '',
    venue: '',
    mapsUrl: '',
    isCheckInSession,
  }
}

function fromEvent(event: EventDetail): SessionDraft[] {
  return event.sessions.map((s) => ({
    key: newKey(),
    id: s.id,
    name: s.name,
    date: splitLocal(s.startsAtLocal).date,
    startTime: splitLocal(s.startsAtLocal).time,
    endTime: splitLocal(s.endsAtLocal).time,
    venue: s.venue,
    mapsUrl: s.mapsUrl ?? '',
    isCheckInSession: s.isCheckInSession,
  }))
}

function toInput(s: SessionDraft): SessionInput {
  return {
    id: s.id,
    name: s.name,
    startsAtLocal: joinLocal(s.date, s.startTime),
    endsAtLocal: joinLocal(s.date, s.endTime),
    venue: s.venue,
    mapsUrl: s.mapsUrl || null,
    isCheckInSession: s.isCheckInSession,
  }
}

function SessionEditor({
  session,
  index,
  canRemove,
  onChange,
  onRemove,
  onCheckIn,
}: {
  session: SessionDraft
  index: number
  canRemove: boolean
  onChange: (patch: Partial<SessionDraft>) => void
  onRemove: () => void
  onCheckIn: () => void
}) {
  const { t } = useTranslation()
  const id = (field: string) => `session-${session.key}-${field}`

  return (
    <fieldset className="space-y-3 rounded-lg border border-brand-100 bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-brand-900">
        {t('events.sessionN', { n: index + 1 })}
      </legend>
      <Field
        id={id('name')}
        label={t('events.sessionName')}
        required
        maxLength={60}
        value={session.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <div className="grid grid-cols-3 gap-2">
        <Field
          id={id('date')}
          label={t('events.date')}
          type="date"
          required
          value={session.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
        <Field
          id={id('start')}
          label={t('events.start')}
          type="time"
          required
          value={session.startTime}
          onChange={(e) => onChange({ startTime: e.target.value })}
        />
        <Field
          id={id('end')}
          label={t('events.end')}
          type="time"
          required
          value={session.endTime}
          onChange={(e) => onChange({ endTime: e.target.value })}
        />
      </div>
      <Field
        id={id('venue')}
        label={t('events.venue')}
        required
        maxLength={200}
        value={session.venue}
        onChange={(e) => onChange({ venue: e.target.value })}
      />
      <Field
        id={id('maps')}
        label={t('events.mapsUrl')}
        type="url"
        placeholder="https://maps.app.goo.gl/…"
        value={session.mapsUrl}
        onChange={(e) => onChange({ mapsUrl: e.target.value })}
      />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="radio" name="checkInSession" checked={session.isCheckInSession} onChange={onCheckIn} />
          {t('events.checkInHere')}
        </label>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-sm text-red-700 underline">
            {t('events.removeSession')}
          </button>
        )}
      </div>
    </fieldset>
  )
}

function EventForm({ event }: { event?: EventDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateEvent()
  const update = useUpdateEvent(event?.id ?? '')
  const mutation = event ? update : create

  const [name, setName] = useState(event?.name ?? '')
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'Wedding')
  const [timeZone, setTimeZone] = useState<EventTimeZone>(event?.timeZone ?? 'Asia/Jakarta')
  const [description, setDescription] = useState(event?.description ?? '')
  const [sessions, setSessions] = useState<SessionDraft[]>(() =>
    event ? fromEvent(event) : [emptySession(t('events.defaultSession'), true)],
  )

  const patch = (key: string, change: Partial<SessionDraft>) =>
    setSessions((all) => all.map((s) => (s.key === key ? { ...s, ...change } : s)))

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: EventInput = {
      name,
      category,
      timeZone,
      description: description || null,
      sessions: sessions.map(toInput),
    }
    const onSuccess = (saved: EventDetail | void) => {
      if (saved) navigate(`/app/events/${saved.id}`, { replace: true })
    }
    if (event) update.mutate({ ...input, version: event.version }, { onSuccess })
    else create.mutate(input, { onSuccess })
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <Field
        label={t('events.name')}
        name="name"
        required
        maxLength={150}
        value={name}
        onChange={(e) => setName(e.target.value)}
        hint={t('events.nameHint')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-left text-sm">
          <span className="font-medium text-stone-700">{t('events.categoryLabel')}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
          >
            {eventCategories.map((c) => (
              <option key={c} value={c}>
                {t(`events.category.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-left text-sm">
          <span className="font-medium text-stone-700">{t('events.timeZone')}</span>
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value as EventTimeZone)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
          >
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {timeZoneLabel[tz]} ({tz})
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-left text-sm">
        <span className="font-medium text-stone-700">{t('events.description')}</span>
        <textarea
          value={description}
          maxLength={2000}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('events.descriptionPlaceholder')}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
        />
      </label>

      <div className="space-y-3">
        <h2 className="font-semibold text-brand-900">{t('events.sessions')}</h2>
        <p className="text-sm text-stone-500">{t('events.sessionsHint', { tz: timeZoneLabel[timeZone] })}</p>
        {sessions.map((session, index) => (
          <SessionEditor
            key={session.key}
            session={session}
            index={index}
            canRemove={sessions.length > 1}
            onChange={(change) => patch(session.key, change)}
            onRemove={() =>
              setSessions((all) => {
                const rest = all.filter((s) => s.key !== session.key)
                // Keep exactly one check-in session.
                return session.isCheckInSession && rest[0]
                  ? rest.map((s, i) => ({ ...s, isCheckInSession: i === rest.length - 1 }))
                  : rest
              })
            }
            onCheckIn={() =>
              setSessions((all) => all.map((s) => ({ ...s, isCheckInSession: s.key === session.key })))
            }
          />
        ))}
        {sessions.length < maxSessions && (
          <button
            type="button"
            onClick={() => setSessions((all) => [emptySession('', false), ...all])}
            className="text-sm font-medium text-brand-700 underline"
          >
            {t('events.addSession')}
          </button>
        )}
      </div>

      {mutation.isError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage(t, mutation.error)}
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-brand-700 px-5 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {event ? t('common.save') : t('events.create')}
      </button>
    </form>
  )
}

export function NewEventPage() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-semibold text-brand-900">{t('events.newTitle')}</h1>
      <EventForm />
    </section>
  )
}

export function EditEventPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { data, isPending, isError, error } = useEvent(id)
  return (
    <section className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-semibold text-brand-900">{t('events.editTitle')}</h1>
      {isPending && <p className="mt-4 text-stone-500">{t('common.loading')}</p>}
      {isError && <p className="mt-4 text-red-700">{errorMessage(t, error)}</p>}
      {data && <EventForm key={data.version} event={data} />}
    </section>
  )
}
