import {
  CalendarHeart,
  Camera,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  Gift,
  Hourglass,
  MailOpen,
  MapPin,
  MessageCircleHeart,
  Music,
  Navigation,
  QrCode,
  Quote,
  ScanLine,
  Send,
  VolumeX,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { ApiError } from '@/api/problem'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Feedback'
import { TextArea, TextField } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Spinner'
import { env } from '@/config/env'
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
  type PublicSession,
} from './api'
import './fonts'
import { GuestGallery } from './GuestGallery'
import { InvitationSection, Ornament, Reveal, ThemeButton } from './InvitationParts'
import { themes, themeVariables, type ThemeDefinition } from './themes'

/** The date of the first session, written as at the venue ("Sabtu, 12 Desember 2026"). */
function firstDate(invitation: PublicInvitation, locale: string) {
  const first = [...invitation.event.sessions].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  )[0]
  if (!first) return null
  const [y, m, d] = first.startsAtLocal.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)))
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

  if (now >= end) return <p className="text-center text-lg font-medium">{t('invitation.finished')}</p>
  if (now >= start) return <p className="text-center text-lg font-medium">{t('invitation.ongoing')}</p>

  const seconds = Math.floor((start - now) / 1000)
  const parts = [
    { value: Math.floor(seconds / 86400), label: t('invitation.days') },
    { value: Math.floor((seconds % 86400) / 3600), label: t('invitation.hours') },
    { value: Math.floor((seconds % 3600) / 60), label: t('invitation.minutes') },
    { value: seconds % 60, label: t('invitation.seconds') },
  ]
  return (
    <div role="timer" aria-label={t('invitation.countdown')} className="grid grid-cols-4 gap-2 sm:gap-3">
      {parts.map((p) => (
        <div key={p.label} className="rounded-2xl py-3 text-center ring-1 ring-(--inv-line)">
          <div className="text-3xl font-semibold text-(--inv-primary) tabular-nums">
            {String(p.value).padStart(2, '0')}
          </div>
          <div className="mt-0.5 text-xs text-(--inv-muted)">{p.label}</div>
        </div>
      ))}
    </div>
  )
}

/** The programme: each session's name and time. Places are in the location block below. */
function Schedule({ invitation }: { invitation: PublicInvitation }) {
  const { t, i18n } = useTranslation()
  const tz = timeZoneLabel[invitation.event.timeZone]
  return (
    <ol className="space-y-4">
      {invitation.event.sessions.map((s) => (
        <li key={s.name + s.startsAt} className="flex gap-4 rounded-2xl p-4 ring-1 ring-(--inv-line)">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--inv-primary)/10 text-(--inv-primary)">
            {s.isCheckInSession ? (
              <ScanLine aria-hidden className="size-5" />
            ) : (
              <Clock aria-hidden className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold">{s.name}</p>
            <p className="mt-0.5 text-sm text-(--inv-muted)">{formatLocal(s.startsAtLocal, i18n.language)}</p>
            <p className="text-sm text-(--inv-muted)">
              {t('invitation.until', { time: formatLocal(s.endsAtLocal, i18n.language, false) })} {tz}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Every distinct place once, with the sessions held there and a Google Maps button (Q-63: no embedded map). */
function Locations({ sessions }: { sessions: PublicSession[] }) {
  const { t } = useTranslation()
  const places = new Map<string, { venue: string; mapsUrl: string | null; sessions: string[] }>()
  for (const s of sessions) {
    const key = `${s.venue}|${s.mapsUrl ?? ''}`
    const place = places.get(key) ?? { venue: s.venue, mapsUrl: s.mapsUrl, sessions: [] }
    place.sessions.push(s.name)
    places.set(key, place)
  }
  return (
    <ul className="space-y-4 text-center">
      {[...places.values()].map((place) => (
        <li key={place.venue + place.mapsUrl} className="space-y-3">
          <MapPin aria-hidden className="mx-auto size-7 text-(--inv-primary)" strokeWidth={1.5} />
          <p className="text-xl font-semibold">{place.venue}</p>
          <p className="text-sm text-(--inv-muted)">{place.sessions.join(' · ')}</p>
          {place.mapsUrl && (
            <a
              href={place.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold text-(--inv-primary) ring-1 ring-(--inv-primary) ring-inset hover:bg-(--inv-primary)/10"
            >
              <Navigation aria-hidden className="size-4" />
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
  const choices = [
    { answer: 'Attending' as const, icon: CircleCheck },
    { answer: 'NotAttending' as const, icon: CircleX },
  ]

  return (
    <div className="space-y-4 text-center">
      {invitation.type === 'Group' && (
        <p className="text-(--inv-muted)">{t('invitation.forPeople', { n: invitation.numberOfPeople })}</p>
      )}
      {isOpen ? (
        <div className="grid grid-cols-2 gap-3">
          {choices.map(({ answer, icon: Icon }) => {
            const selected = status === answer
            return (
              <button
                key={answer}
                type="button"
                disabled={save.isPending}
                aria-pressed={selected}
                onClick={() => save.mutate(answer)}
                className={cn(
                  'flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 font-semibold transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:opacity-60',
                  selected
                    ? 'bg-(--inv-primary) text-(--inv-primary-ink) shadow-[0_10px_30px_-12px_var(--inv-primary)]'
                    : 'text-(--inv-ink) ring-1 ring-(--inv-line) hover:ring-(--inv-primary)',
                )}
              >
                <Icon aria-hidden className="size-7" strokeWidth={1.75} />
                {t(`invitation.rsvp.${answer}`)}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-(--inv-muted)">{t('invitation.rsvpClosed')}</p>
      )}
      {status !== 'Pending' && (
        <p role="status" className="font-medium text-(--inv-primary)">
          {t(`invitation.answer.${status}`)}
        </p>
      )}
      {save.isError && <Notice tone="danger">{errorMessage(t, save.error)}</Notice>}
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
    <div className="space-y-5">
      {invitation.features.wishesOpen ? (
        <form onSubmit={submit} className="space-y-3">
          <TextArea
            id="wish"
            label={invitation.myWish ? t('invitation.editWish') : t('invitation.writeWish')}
            rows={3}
            maxLength={500}
            required
            value={text}
            onChange={(e) => setDraft(e.target.value)}
          />
          {save.isError && <Notice tone="danger">{errorMessage(t, save.error)}</Notice>}
          <ThemeButton
            type="submit"
            icon={Send}
            loading={save.isPending}
            disabled={!text.trim()}
            className="w-full"
          >
            {t('invitation.sendWish')}
          </ThemeButton>
        </form>
      ) : (
        <p className="text-center text-sm text-(--inv-muted)">{t('invitation.wishesClosed')}</p>
      )}
      <ul className="max-h-[32rem] space-y-3 overflow-y-auto overscroll-contain pr-1">
        {wishes.data?.pages
          .flatMap((p) => p.wishes)
          .map((w) => (
            <li key={w.guestName + w.createdAt} className="relative rounded-2xl p-4 ring-1 ring-(--inv-line)">
              <Quote
                aria-hidden
                className="absolute top-3 right-3 size-5 text-(--inv-secondary) opacity-50"
              />
              <p className="pr-6 font-semibold">
                {w.guestName}
                {w.isMine && <span className="font-normal text-(--inv-muted)"> · {t('invitation.you')}</span>}
              </p>
              {/* Plain text: React escapes it, so a message can't inject markup. */}
              <p className="mt-1 whitespace-pre-line text-(--inv-ink)">{w.message}</p>
              <p className="mt-2 text-xs text-(--inv-muted)">
                {new Date(w.createdAt).toLocaleDateString(i18n.language)}
              </p>
            </li>
          ))}
      </ul>
      {wishes.hasNextPage && (
        <ThemeButton variant="outline" onClick={() => void wishes.fetchNextPage()} className="mx-auto flex">
          {t('invitation.moreWishes')}
        </ThemeButton>
      )}
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <ThemeButton
      variant="outline"
      icon={copied ? Check : Copy}
      className="min-h-10 px-4 text-sm"
      onClick={() =>
        void navigator.clipboard.writeText(value.replace(/[\s-]/g, '')).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        })
      }
    >
      {copied ? t('guests.copied') : t('invitation.copyNumber')}
    </ThemeButton>
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
  const { accounts, address, qrisUrl } = gifts.data
  if (accounts.length === 0 && !address && !qrisUrl)
    return <p className="text-center text-sm text-(--inv-muted)">{t('invitation.noGifts')}</p>

  function submit(e: FormEvent) {
    e.preventDefault()
    confirm.mutate({ senderName, amount: amount ? Number(amount) : null, note: note.trim() || null })
  }

  return (
    <div className="space-y-5">
      <p className="text-center text-(--inv-muted)">{t('invitation.giftHint')}</p>
      <ul className="space-y-3">
        {accounts.map((a) => (
          <li
            key={a.provider + a.accountNumber}
            className="rounded-2xl bg-linear-to-br from-(--inv-primary)/10 to-(--inv-secondary)/10 p-5 text-center ring-1 ring-(--inv-line)"
          >
            <p className="text-sm font-semibold tracking-wide text-(--inv-primary) uppercase">{a.provider}</p>
            <p className="mt-1 text-2xl font-semibold tracking-wider tabular-nums">{a.accountNumber}</p>
            <p className="mt-0.5 mb-3 text-sm text-(--inv-muted)">a.n. {a.accountHolder}</p>
            <CopyButton value={a.accountNumber} />
          </li>
        ))}
      </ul>
      {qrisUrl && (
        <figure className="rounded-2xl bg-white p-4 text-center">
          <img src={qrisUrl} alt="QRIS" className="mx-auto max-h-80 rounded-lg" />
          <figcaption className="mt-2 text-xs text-stone-600">{t('invitation.qrisHint')}</figcaption>
        </figure>
      )}
      {address && (
        <div className="rounded-2xl p-4 text-center ring-1 ring-(--inv-line)">
          <p className="text-sm font-semibold text-(--inv-primary)">{t('invitation.giftAddress')}</p>
          <p className="mt-1 whitespace-pre-line">{address}</p>
        </div>
      )}
      <details className="group rounded-2xl ring-1 ring-(--inv-line)">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 px-4 font-medium text-(--inv-primary) [&::-webkit-details-marker]:hidden">
          <Gift aria-hidden className="size-4" />
          {t('invitation.confirmGift')}
        </summary>
        <div className="px-4 pb-4">
          {confirm.isSuccess ? (
            <Notice tone="success">{t('invitation.giftThanks')}</Notice>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <TextField
                id="gift-sender"
                label={t('invitation.senderName')}
                required
                maxLength={100}
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
              <TextField
                id="gift-amount"
                label={t('invitation.amount')}
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <TextField
                id="gift-note"
                label={t('invitation.note')}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {confirm.isError && <Notice tone="danger">{errorMessage(t, confirm.error)}</Notice>}
              <ThemeButton type="submit" loading={confirm.isPending} className="w-full">
                {t('invitation.sendConfirmation')}
              </ThemeButton>
            </form>
          )}
        </div>
      </details>
    </div>
  )
}

/**
 * The full-screen cover: the event's photo (or the theme's background), the names, the date, the guest,
 * and "Buka Undangan". Opening slides it up; while it slides it is inert, so only the page is reachable.
 */
function Cover({
  invitation,
  theme,
  opened,
  onOpen,
  onGone,
}: {
  invitation: PublicInvitation
  theme: ThemeDefinition
  opened: boolean
  onOpen: () => void
  onGone: () => void
}) {
  const { t, i18n } = useTranslation()
  const photo = invitation.event.coverUrl
  const date = firstDate(invitation, i18n.language)
  const light = !!photo || theme.scheme === 'dark'
  const ink = light ? 'text-white' : 'text-(--inv-ink)'
  const item = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <motion.div
      aria-hidden={opened || undefined}
      inert={opened}
      initial={false}
      animate={opened ? { y: '-100%' } : { y: 0 }}
      transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
      onAnimationComplete={() => opened && onGone()}
      className="fixed inset-0 z-50 overflow-hidden"
      style={photo ? undefined : { background: theme.backgroundStyle }}
    >
      {photo && (
        <>
          <motion.img
            src={photo}
            alt=""
            className="absolute inset-0 size-full object-cover"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 6, ease: 'easeOut' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-b from-black/30 via-black/35 to-black/75"
          />
        </>
      )}
      <div
        className={cn(
          'relative flex h-full flex-col items-center px-6 pt-16 pb-[max(3rem,env(safe-area-inset-bottom))] text-center',
          // Over a photo the text sits low, clear of the faces; on a plain background it is centred.
          photo ? 'justify-end sm:justify-center' : 'justify-center',
          ink,
        )}
      >
        <motion.p {...item(0.1)} className="text-xs tracking-[0.35em] uppercase opacity-85">
          {t(`invitation.coverEyebrow.${invitation.event.category}`)}
        </motion.p>
        <motion.h1
          {...item(0.25)}
          // The colour is set on the heading itself: the global h1 style would win over the inherited one.
          className={cn(
            'mt-4 text-5xl leading-[1.05] sm:text-7xl',
            theme.fontHeading,
            light ? 'text-white' : 'text-(--inv-ink)',
          )}
        >
          {invitation.event.name}
        </motion.h1>
        {date && (
          <motion.p {...item(0.4)} className="mt-4 text-base opacity-90">
            {date}
          </motion.p>
        )}
        <motion.div {...item(0.55)} className="mt-8 w-full max-w-xs">
          <Ornament className={light ? 'text-white/80' : undefined} />
          <p className="mt-4 text-sm opacity-80">{t('invitation.dear')}</p>
          <p className="mt-1 text-2xl font-semibold">{invitation.guestName}</p>
        </motion.div>
        <motion.div {...item(0.75)} className="mt-8">
          <ThemeButton icon={MailOpen} onClick={onOpen} className="min-h-14 px-8 text-base">
            {t('invitation.open')}
          </ThemeButton>
        </motion.div>
      </div>
    </motion.div>
  )
}

/** Floating music switch; the note turns while the music plays. */
function MusicButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? t('invitation.unmute') : t('invitation.mute')}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-12 items-center justify-center rounded-full bg-(--inv-primary) text-(--inv-primary-ink) shadow-[0_10px_30px_-10px_var(--inv-primary)] transition-transform active:scale-95"
    >
      {muted ? (
        <VolumeX aria-hidden className="size-5" />
      ) : (
        <Music aria-hidden className="size-5 animate-[spin_6s_linear_infinite] motion-reduce:animate-none" />
      )}
    </button>
  )
}

/**
 * The guest's invitation page (/i/:code), in the event's theme (Q-62). A full-screen cover opens with
 * "Buka Undangan" (which also starts the music, because browsers block autoplay with sound, Q-43), then
 * the blocks fade in as the guest scrolls.
 */
export function InvitationPage() {
  const { t, i18n } = useTranslation()
  const { code = '' } = useParams()
  const invitation = usePublicInvitation(code)
  const [opened, setOpened] = useState(false)
  const [coverGone, setCoverGone] = useState(false)
  const music = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState(false)

  if (invitation.isPending) return <Loading className="min-h-dvh" />
  if (invitation.isError) {
    const notFound = invitation.error instanceof ApiError && invitation.error.status === 404
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <CalendarHeart aria-hidden className="size-10 text-brand-300" strokeWidth={1.5} />
        <h1 className="font-serif text-3xl font-medium text-brand-950">
          {notFound ? t('invitation.notFoundTitle') : t('error.genericTitle')}
        </h1>
        <p className="text-stone-600">
          {notFound ? t('invitation.notFoundBody') : errorMessage(t, invitation.error)}
        </p>
      </div>
    )
  }

  const data = invitation.data
  const theme = themes[data.event.theme] ?? themes.Elegant
  const heading = theme.fontHeading
  const musicSrc = data.features.backgroundMusic
    ? `${env.apiBaseUrl}/public/invitations/${encodeURIComponent(code)}/music`
    : null
  const date = firstDate(data, i18n.language)
  // Browsers block autoplay with sound: the tap on "Buka Undangan" starts the music (Q-43).
  const open = () => {
    setOpened(true)
    window.scrollTo({ top: 0 })
    void music.current?.play().catch(() => undefined)
  }

  return (
    <div
      className="min-h-dvh text-(--inv-ink)"
      style={{ ...themeVariables(theme), background: theme.backgroundStyle, backgroundAttachment: 'fixed' }}
    >
      {/* One audio element for the cover and the page, so the music keeps playing when the cover closes. */}
      {musicSrc && <audio ref={music} src={musicSrc} loop preload="auto" muted={muted} />}
      {!coverGone && (
        <Cover
          invitation={data}
          theme={theme}
          opened={opened}
          onOpen={open}
          onGone={() => setCoverGone(true)}
        />
      )}

      {opened && (
        <main className="mx-auto max-w-xl space-y-6 px-4 pt-6 pb-24 sm:space-y-8 sm:pt-10">
          <Reveal>
            <header className="text-center">
              {data.event.coverUrl && (
                <img
                  src={data.event.coverUrl}
                  alt=""
                  className="mb-8 aspect-[4/5] w-full rounded-[2rem] object-cover shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)] sm:aspect-[4/3]"
                />
              )}
              <p className="text-xs tracking-[0.35em] text-(--inv-muted) uppercase">
                {t('invitation.weInvite')}
              </p>
              <h1 className={cn('mt-4 text-5xl leading-[1.05] text-(--inv-ink) sm:text-6xl', heading)}>
                {data.event.name}
              </h1>
              {date && <p className="mt-4 text-lg text-(--inv-muted)">{date}</p>}
              <Ornament className="mt-6" />
              <p className="mt-6 text-(--inv-muted)">{t('invitation.forGuest', { name: data.guestName })}</p>
            </header>
          </Reveal>

          {data.event.description && (
            <InvitationSection
              title={t(
                data.event.category === 'Wedding' ? 'invitation.storyWedding' : 'invitation.storyOther',
              )}
              icon={Quote}
              headingClass={heading}
            >
              <p className="text-center text-lg leading-relaxed whitespace-pre-line">
                {data.event.description}
              </p>
            </InvitationSection>
          )}

          {data.features.countdown && (
            <InvitationSection
              title={t(
                data.event.category === 'Wedding' ? 'invitation.countdownTitle' : 'invitation.countdownOther',
              )}
              icon={Hourglass}
              headingClass={heading}
            >
              <Countdown invitation={data} />
            </InvitationSection>
          )}

          <InvitationSection title={t('invitation.when')} icon={CalendarHeart} headingClass={heading}>
            <Schedule invitation={data} />
          </InvitationSection>

          <InvitationSection title={t('invitation.locationTitle')} icon={MapPin} headingClass={heading}>
            <Locations sessions={data.event.sessions} />
          </InvitationSection>

          <InvitationSection title={t('invitation.rsvpTitle')} icon={CircleCheck} headingClass={heading}>
            <Rsvp code={code} invitation={data} />
          </InvitationSection>

          <InvitationSection title={t('invitation.qrTitle')} icon={QrCode} headingClass={heading}>
            {/* Always on white, so any scanner reads it, also in a dark theme. */}
            <div className="mx-auto w-fit rounded-3xl bg-white p-4 shadow-[0_12px_40px_-20px_rgb(0_0_0/0.4)]">
              <img src={publicQrUrl(code)} alt={t('invitation.qrAlt')} className="size-56" />
            </div>
            <p className="mt-4 text-center text-(--inv-muted)">
              {data.checkedIn ? t('invitation.checkedIn') : t('invitation.qrHint')}
            </p>
          </InvitationSection>

          {data.checkedIn && (
            <InvitationSection title={t('photos.guestGalleryTitle')} icon={Camera} headingClass={heading}>
              <GuestGallery code={code} />
            </InvitationSection>
          )}

          {data.features.wishes && (
            <InvitationSection
              title={t('invitation.wishesTitle')}
              icon={MessageCircleHeart}
              headingClass={heading}
            >
              <Wishes code={code} invitation={data} />
            </InvitationSection>
          )}

          {data.features.digitalGift && (
            <InvitationSection title={t('invitation.giftsTitle')} icon={Gift} headingClass={heading}>
              <Gifts code={code} />
            </InvitationSection>
          )}

          <footer className="space-y-2 pt-4 text-center text-xs text-(--inv-muted)">
            <p>{t('invitation.privacy')}</p>
            <p>{t('invitation.madeWith', { app: env.appName })}</p>
          </footer>
          {musicSrc && <MusicButton muted={muted} onToggle={() => setMuted(!muted)} />}
        </main>
      )}
    </div>
  )
}
