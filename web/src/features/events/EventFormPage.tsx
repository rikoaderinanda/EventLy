import {
  ArrowLeft,
  Briefcase,
  Cake,
  Heart,
  MapPin,
  PartyPopper,
  Plus,
  ScanLine,
  Trash2,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, PageHeader, SectionHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Feedback'
import { Select, TextArea, TextField } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Spinner'
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

const categoryIcons: Record<EventCategory, typeof Heart> = {
  Wedding: Heart,
  Birthday: Cake,
  Corporate: Briefcase,
  Community: Users,
  Other: PartyPopper,
}

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
    <fieldset
      className={cn(
        'space-y-4 rounded-2xl border bg-white p-4 shadow-soft sm:p-5',
        session.isCheckInSession ? 'border-brand-300 ring-2 ring-brand-100' : 'border-brand-100',
      )}
    >
      <legend className="float-left mb-1 w-full text-sm font-semibold text-brand-900">
        {t('events.sessionN', { n: index + 1 })}
      </legend>
      <TextField
        id={id('name')}
        label={t('events.sessionName')}
        required
        maxLength={60}
        value={session.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          id={id('date')}
          label={t('events.date')}
          type="date"
          required
          value={session.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <TextField
            id={id('start')}
            label={t('events.start')}
            type="time"
            required
            value={session.startTime}
            onChange={(e) => onChange({ startTime: e.target.value })}
          />
          <TextField
            id={id('end')}
            label={t('events.end')}
            type="time"
            required
            value={session.endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
          />
        </div>
      </div>
      <TextField
        id={id('venue')}
        label={t('events.venue')}
        icon={MapPin}
        required
        maxLength={200}
        value={session.venue}
        onChange={(e) => onChange({ venue: e.target.value })}
      />
      <TextField
        id={id('maps')}
        label={t('events.mapsUrl')}
        type="url"
        placeholder="https://maps.app.goo.gl/…"
        value={session.mapsUrl}
        onChange={(e) => onChange({ mapsUrl: e.target.value })}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          className={cn(
            'inline-flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
            session.isCheckInSession
              ? 'bg-brand-100 font-medium text-brand-900'
              : 'text-stone-600 hover:bg-brand-50',
          )}
        >
          <input
            type="radio"
            name="checkInSession"
            className="size-4 accent-brand-600"
            checked={session.isCheckInSession}
            onChange={onCheckIn}
          />
          <ScanLine aria-hidden className="size-4" />
          {t('events.checkInHere')}
        </label>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={onRemove}
            className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
          >
            {t('events.removeSession')}
          </Button>
        )}
      </div>
    </fieldset>
  )
}

/** Category as a row of icon tiles (a radio group), rather than a select. */
function CategoryPicker({ value, onChange }: { value: EventCategory; onChange: (c: EventCategory) => void }) {
  const { t } = useTranslation()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-stone-700">{t('events.categoryLabel')}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {eventCategories.map((c) => {
          const Icon = categoryIcons[c]
          const selected = value === c
          return (
            <label
              key={c}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600',
                selected
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-900'
                  : 'border-stone-200 text-stone-600 hover:border-brand-200',
              )}
            >
              <input
                type="radio"
                name="category"
                value={c}
                checked={selected}
                onChange={() => onChange(c)}
                className="sr-only"
              />
              <Icon aria-hidden className={cn('size-5', selected ? 'text-brand-600' : 'text-stone-400')} />
              {t(`events.category.${c}`)}
            </label>
          )
        })}
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
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-5">
        <SectionHeader title={t('events.basics')} level={3} className="mb-0" />
        <TextField
          label={t('events.name')}
          name="name"
          required
          maxLength={150}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={t('events.nameHint')}
        />
        <CategoryPicker value={category} onChange={setCategory} />
        <Select
          label={t('events.timeZone')}
          name="timeZone"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value as EventTimeZone)}
        >
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>
              {timeZoneLabel[tz]} ({tz})
            </option>
          ))}
        </Select>
        <TextArea
          label={t('events.description')}
          name="description"
          value={description}
          maxLength={2000}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('events.descriptionPlaceholder')}
          hint={t('events.descriptionHint')}
        />
      </Card>

      <section className="space-y-3">
        <SectionHeader
          title={t('events.sessions')}
          description={t('events.sessionsHint', { tz: timeZoneLabel[timeZone] })}
          level={3}
          className="mb-1"
          actions={
            sessions.length < maxSessions && (
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => setSessions((all) => [emptySession('', false), ...all])}
              >
                {t('events.addSession')}
              </Button>
            )
          }
        />
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
      </section>

      {mutation.isError && <Notice tone="danger">{errorMessage(t, mutation.error)}</Notice>}
      <Button type="submit" size="lg" block="mobile" loading={mutation.isPending}>
        {event ? t('common.save') : t('events.create')}
      </Button>
    </form>
  )
}

export function NewEventPage() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-3xl py-6 sm:py-10">
      <ButtonLink to="/app/events" variant="ghost" size="sm" icon={ArrowLeft} className="mb-4 -ml-3">
        {t('events.title')}
      </ButtonLink>
      <PageHeader title={t('events.newTitle')} subtitle={t('events.newSubtitle')} />
      <EventForm />
    </section>
  )
}

export function EditEventPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { data, isPending, isError, error } = useEvent(id)
  return (
    <section className="mx-auto max-w-3xl py-6 sm:py-10">
      <ButtonLink to={`/app/events/${id}`} variant="ghost" size="sm" icon={ArrowLeft} className="mb-4 -ml-3">
        {data?.name ?? t('events.title')}
      </ButtonLink>
      <PageHeader title={t('events.editTitle')} />
      {isPending && <Loading />}
      {isError && <Notice tone="danger">{errorMessage(t, error)}</Notice>}
      {data && <EventForm key={data.version} event={data} />}
    </section>
  )
}
