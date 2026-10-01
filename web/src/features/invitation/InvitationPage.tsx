import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { ApiError } from '@/api/problem'
import { formatLocal, timeZoneLabel } from '@/features/events/format'
import { errorMessage } from '@/shared/lib/errors'
import {
  publicQrUrl,
  useConfirmGift,
  usePublicGifts,
  usePublicInvitation,
  usePublicWishes,
  useSetRsvp,
  useSetWish,
  type PublicInvitation,
} from './api'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-white/90 p-5 shadow-sm">
      <h2 className="text-center text-lg font-semibold text-brand-900">{title}</h2>
      {children}
    </section>
  )
}

/** Q-44: counts down to the first session, then "ongoing", then "finished". */
function Countdown({ invitation }: { invitation: PublicInvitation }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const sessions = invitation.event.sessions
  if (sessions.length === 0) return null
  const start = Math.min(...sessions.map((s) => Date.parse(s.startsAt)))
  const end = Math.max(...sessions.map((s) => Date.parse(s.endsAt)))

  if (now >= end) return <p className="text-center font-medium text-brand-900">{t('invitation.finished')}</p>
  if (now >= start) return <p className="text-center font-medium text-brand-900">{t('invitation.ongoing')}</p>

  const seconds = Math.floor((start - now) / 1000)
  const parts = [
    { value: Math.floor(seconds / 86400), label: t('invitation.days') },
    { value: Math.floor((seconds % 86400) / 3600), label: t('invitation.hours') },
    { value: Math.floor((seconds % 3600) / 60), label: t('invitation.minutes') },
    { value: seconds % 60, label: t('invitation.seconds') },
  ]
  return (
    <div role="timer" aria-label={t('invitation.countdown')} className="flex justify-center gap-3">
      {parts.map((p) => (
        <div key={p.label} className="w-16 rounded-xl bg-brand-100 py-2 text-center">
          <div className="text-2xl font-semibold text-brand-900 tabular-nums">{p.value}</div>
          <div className="text-xs text-stone-600">{p.label}</div>
        </div>
      ))}
    </div>
  )
}

function Sessions({ invitation }: { invitation: PublicInvitation }) {
  const { t, i18n } = useTranslation()
  const tz = timeZoneLabel[invitation.event.timeZone]
  return (
    <ul className="space-y-4 text-center">
      {invitation.event.sessions.map((s) => (
        <li key={s.name + s.startsAt}>
          <p className="font-semibold text-brand-900">{s.name}</p>
          <p className="text-sm text-stone-700">{formatLocal(s.startsAtLocal, i18n.language)}</p>
          <p className="text-sm text-stone-700">
            {t('invitation.until', { time: formatLocal(s.endsAtLocal, i18n.language, false) })} {tz}
          </p>
          <p className="text-sm text-stone-700">{s.venue}</p>
          {s.mapsUrl && (
            <a
              href={s.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block rounded-full border border-brand-700 px-4 py-1 text-sm text-brand-700"
            >
              {t('events.openMaps')}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

function Rsvp({ code, invitation }: { code: string; invitation: PublicInvitation }) {
  const { t } = useTranslation()
  const save = useSetRsvp(code)
  const { status, isOpen } = invitation.rsvp

  return (
    <div className="space-y-3 text-center">
      {invitation.type === 'Group' && (
        <p className="text-sm text-stone-600">
          {t('invitation.forPeople', { n: invitation.numberOfPeople })}
        </p>
      )}
      {status !== 'Pending' && (
        <p role="status" className="font-medium text-brand-900">
          {t(`invitation.answer.${status}`)}
        </p>
      )}
      {isOpen ? (
        <div className="flex justify-center gap-2">
          {(['Attending', 'NotAttending'] as const).map((answer) => (
            <button
              key={answer}
              type="button"
              disabled={save.isPending}
              aria-pressed={status === answer}
              onClick={() => save.mutate(answer)}
              className="rounded-full border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 aria-pressed:bg-brand-700 aria-pressed:text-white disabled:opacity-50"
            >
              {t(`invitation.rsvp.${answer}`)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-600">{t('invitation.rsvpClosed')}</p>
      )}
      {save.isError && <p className="text-sm text-red-700">{errorMessage(t, save.error)}</p>}
    </div>
  )
}

function Wishes({ code, invitation }: { code: string; invitation: PublicInvitation }) {
  const { t, i18n } = useTranslation()
  const wishes = usePublicWishes(code, true)
  const save = useSetWish(code)
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? invitation.myWish ?? ''

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(text, { onSuccess: () => setDraft(null) })
  }

  return (
    <div className="space-y-4">
      {invitation.features.wishesOpen ? (
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="wish" className="text-sm font-medium text-stone-700">
            {invitation.myWish ? t('invitation.editWish') : t('invitation.writeWish')}
          </label>
          <textarea
            id="wish"
            rows={3}
            maxLength={500}
            required
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2"
          />
          {save.isError && <p className="text-sm text-red-700">{errorMessage(t, save.error)}</p>}
          <button
            type="submit"
            disabled={save.isPending || !text.trim()}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('invitation.sendWish')}
          </button>
        </form>
      ) : (
        <p className="text-center text-sm text-stone-600">{t('invitation.wishesClosed')}</p>
      )}
      <ul className="space-y-3">
        {wishes.data?.pages
          .flatMap((p) => p.wishes)
          .map((w) => (
            <li key={w.guestName + w.createdAt} className="rounded-lg bg-brand-50 p-3">
              <p className="text-sm font-semibold text-brand-900">
                {w.guestName}
                {w.isMine && <span className="font-normal text-stone-500"> · {t('invitation.you')}</span>}
              </p>
              {/* Plain text: React escapes it, so a message can't inject markup. */}
              <p className="text-sm whitespace-pre-line text-stone-700">{w.message}</p>
              <p className="mt-1 text-xs text-stone-500">
                {new Date(w.createdAt).toLocaleDateString(i18n.language)}
              </p>
            </li>
          ))}
      </ul>
      {wishes.hasNextPage && (
        <button
          type="button"
          onClick={() => void wishes.fetchNextPage()}
          className="mx-auto block text-sm text-brand-700 underline"
        >
          {t('invitation.moreWishes')}
        </button>
      )}
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(value.replace(/[\s-]/g, '')).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        })
      }
      className="rounded-full border border-brand-700 px-3 py-1 text-xs text-brand-700"
    >
      {copied ? t('guests.copied') : t('invitation.copyNumber')}
    </button>
  )
}

function Gifts({ code }: { code: string }) {
  const { t } = useTranslation()
  const gifts = usePublicGifts(code, true)
  const confirm = useConfirmGift(code)
  const [senderName, setSenderName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  if (!gifts.data) return null
  const { accounts, address } = gifts.data
  if (accounts.length === 0 && !address)
    return <p className="text-center text-sm text-stone-600">{t('invitation.noGifts')}</p>

  function submit(e: FormEvent) {
    e.preventDefault()
    confirm.mutate({ senderName, amount: amount ? Number(amount) : null, note: note.trim() || null })
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-stone-600">{t('invitation.giftHint')}</p>
      <ul className="space-y-3">
        {accounts.map((a) => (
          <li key={a.provider + a.accountNumber} className="rounded-lg bg-brand-50 p-3 text-center">
            <p className="text-sm font-semibold text-brand-900">{a.provider}</p>
            <p className="text-lg font-medium tracking-wide text-stone-900">{a.accountNumber}</p>
            <p className="mb-2 text-sm text-stone-600">a.n. {a.accountHolder}</p>
            <CopyButton value={a.accountNumber} />
          </li>
        ))}
      </ul>
      {address && (
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-900">{t('invitation.giftAddress')}</p>
          <p className="text-sm whitespace-pre-line text-stone-700">{address}</p>
        </div>
      )}
      <details className="rounded-lg border border-brand-100 p-3 text-sm">
        <summary className="cursor-pointer text-center text-brand-700">{t('invitation.confirmGift')}</summary>
        {confirm.isSuccess ? (
          <p role="status" className="mt-3 text-center text-emerald-700">
            {t('invitation.giftThanks')}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <label className="block">
              <span className="text-stone-700">{t('invitation.senderName')}</span>
              <input
                required
                maxLength={100}
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-stone-700">{t('invitation.amount')}</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-stone-700">{t('invitation.note')}</span>
              <input
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>
            {confirm.isError && <p className="text-red-700">{errorMessage(t, confirm.error)}</p>}
            <button
              type="submit"
              disabled={confirm.isPending}
              className="rounded-full bg-brand-700 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {t('invitation.sendConfirmation')}
            </button>
          </form>
        )}
      </details>
    </div>
  )
}

function Cover({ invitation, onOpen }: { invitation: PublicInvitation; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-brand-900 px-6 text-center text-brand-50">
      <p className="text-sm tracking-widest uppercase opacity-80">
        {t(`events.category.${invitation.event.category}`)}
      </p>
      <h1 className="text-3xl font-semibold">{invitation.event.name}</h1>
      <div>
        <p className="text-sm opacity-80">{t('invitation.dear')}</p>
        <p className="text-xl font-medium">{invitation.guestName}</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full bg-brand-50 px-6 py-3 font-semibold text-brand-900 shadow"
      >
        {t('invitation.open')}
      </button>
    </div>
  )
}

/**
 * The guest's invitation page (/i/:code). Opens with a "Buka Undangan" cover; background music (Phase 9,
 * storage) will start on that tap, because browsers block autoplay with sound.
 */
export function InvitationPage() {
  const { t } = useTranslation()
  const { code = '' } = useParams()
  const invitation = usePublicInvitation(code)
  const [opened, setOpened] = useState(false)

  if (invitation.isPending) return <p className="py-16 text-center text-stone-500">{t('common.loading')}</p>
  if (invitation.isError) {
    const notFound = invitation.error instanceof ApiError && invitation.error.status === 404
    return (
      <div className="mx-auto max-w-md space-y-2 px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-brand-900">
          {notFound ? t('invitation.notFoundTitle') : t('error.genericTitle')}
        </h1>
        <p className="text-stone-600">
          {notFound ? t('invitation.notFoundBody') : errorMessage(t, invitation.error)}
        </p>
      </div>
    )
  }

  const data = invitation.data
  if (!opened) return <Cover invitation={data} onOpen={() => setOpened(true)} />

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-8">
      <header className="space-y-2 text-center">
        <p className="text-sm tracking-widest text-brand-700 uppercase">{t('invitation.weInvite')}</p>
        <h1 className="text-3xl font-semibold text-brand-900">{data.event.name}</h1>
        {data.event.description && (
          <p className="whitespace-pre-line text-stone-700">{data.event.description}</p>
        )}
      </header>

      {data.features.countdown && <Countdown invitation={data} />}

      <Section title={t('invitation.when')}>
        <Sessions invitation={data} />
      </Section>

      <Section title={t('invitation.rsvpTitle')}>
        <Rsvp code={code} invitation={data} />
      </Section>

      <Section title={t('invitation.qrTitle')}>
        <img src={publicQrUrl(code)} alt={t('invitation.qrAlt')} className="mx-auto size-56" />
        <p className="text-center text-sm text-stone-600">
          {data.checkedIn ? t('invitation.checkedIn') : t('invitation.qrHint')}
        </p>
      </Section>

      {data.features.wishes && (
        <Section title={t('invitation.wishesTitle')}>
          <Wishes code={code} invitation={data} />
        </Section>
      )}

      {data.features.digitalGift && (
        <Section title={t('invitation.giftsTitle')}>
          <Gifts code={code} />
        </Section>
      )}

      <p className="text-center text-xs text-stone-500">{t('invitation.privacy')}</p>
    </main>
  )
}
