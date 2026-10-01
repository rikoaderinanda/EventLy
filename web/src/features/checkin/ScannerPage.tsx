import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  History,
  type LucideIcon,
  QrCode,
  Search,
  TriangleAlert,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/problem'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Loading } from '@/components/ui/Spinner'
import { useEvent } from '@/features/events/api'
import { StaffPhotoButton } from '@/features/photos/StaffPhotoButton'
import { errorMessage } from '@/shared/lib/errors'
import { vibrate } from '@/shared/lib/haptics'
import {
  lookup,
  useCheckIn,
  useCheckInSearch,
  useCheckInSummary,
  useMyActivity,
  type CheckInResult,
  type CheckInTarget,
} from './api'
import { QrScanner } from './QrScanner'

type Sheet =
  | { kind: 'loading' }
  | { kind: 'found'; target: CheckInTarget; result: CheckInResult }
  | { kind: 'done'; result: CheckInResult }
  | { kind: 'error'; error: unknown }

type Tab = 'scan' | 'manual' | 'mine'

function time(value: string | null, locale: string) {
  return value ? new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''
}

/** The big round status mark at the top of the result: it pops in, so the result reads at a glance. */
function StatusMark({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <motion.span
      // Scale only: the mark is fully visible from the first frame even if the animation stutters.
      initial={{ scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', damping: 14, stiffness: 320 }}
      className={cn('mx-auto flex size-20 items-center justify-center rounded-full', tone)}
    >
      <Icon aria-hidden className="size-11" strokeWidth={2.25} />
    </motion.span>
  )
}

/**
 * The result of a scan as a bottom sheet: green for a new check-in, amber for a repeat scan, red for an
 * invalid invitation. The main button has focus, so a keyboard or a Bluetooth scanner can confirm with Enter.
 */
function ResultSheet({
  sheet,
  onConfirm,
  confirming,
  onNext,
}: {
  sheet: Sheet
  onConfirm: () => void
  confirming: boolean
  onNext: () => void
}) {
  const { t, i18n } = useTranslation()

  if (sheet.kind === 'loading')
    return (
      <Modal open onClose={onNext} title={t('checkin.checking')}>
        <Loading />
      </Modal>
    )

  if (sheet.kind === 'error') {
    const notFound = sheet.error instanceof ApiError && sheet.error.status === 404
    return (
      <Modal
        open
        onClose={onNext}
        title={notFound ? t('checkin.invalidTitle') : t('checkin.errorTitle')}
        footer={
          <Button size="lg" block data-autofocus autoFocus onClick={onNext}>
            {t('checkin.next')}
          </Button>
        }
      >
        <div role="alert" className="space-y-4 pb-2 text-center">
          <StatusMark icon={CircleAlert} tone="bg-danger-50 text-danger-500" />
          <p className="text-body text-danger-700">{errorMessage(t, sheet.error)}</p>
        </div>
      </Modal>
    )
  }

  const { result } = sheet
  const repeat = result.alreadyCheckedIn
  const done = sheet.kind === 'done'
  const title = repeat ? t('checkin.alreadyTitle') : done ? t('checkin.success') : t('checkin.foundTitle')

  return (
    <Modal
      open
      onClose={onNext}
      dismissible={!confirming}
      title={title}
      footer={
        sheet.kind === 'found' && !repeat ? (
          <>
            <Button variant="ghost" size="lg" block="mobile" onClick={onNext}>
              {t('checkin.cancel')}
            </Button>
            <Button
              variant="success"
              size="lg"
              block="mobile"
              icon={CircleCheck}
              loading={confirming}
              data-autofocus
              autoFocus
              onClick={onConfirm}
            >
              {t('checkin.confirm')}
            </Button>
          </>
        ) : (
          <Button size="lg" block data-autofocus autoFocus onClick={onNext}>
            {t('checkin.next')}
          </Button>
        )
      }
    >
      <div role="status" className="space-y-4 pb-2 text-center">
        {done && !repeat && <StatusMark icon={CircleCheck} tone="bg-success-50 text-success-500" />}
        {repeat && <StatusMark icon={TriangleAlert} tone="bg-warning-50 text-warning-500" />}
        {sheet.kind === 'found' && !repeat && (
          <Avatar name={result.guestName} size="lg" className="mx-auto size-20 text-2xl" />
        )}
        {repeat && (
          <p className="font-medium text-warning-700">
            {t('checkin.already', {
              time: time(result.checkedInAt, i18n.language),
              by: result.checkedInBy ?? '',
            })}
          </p>
        )}
        <div>
          <p className="text-[1.75rem] leading-tight font-semibold text-brand-950">{result.guestName}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-body text-stone-600">
            {result.type === 'Group' ? (
              <UsersRound aria-hidden className="size-4" />
            ) : (
              <UserRound aria-hidden className="size-4" />
            )}
            {result.type === 'Group'
              ? t('guests.groupOf', { n: result.numberOfPeople })
              : t('guests.type.Individual')}
          </p>
        </div>
        {result.warnings.map((w) => (
          <Notice key={w} tone="warning" className="text-left">
            {t(`checkin.warning.${w}`)}
          </Notice>
        ))}
        {(done || repeat) && (
          <StaffPhotoButton key={result.invitationId} invitationId={result.invitationId} />
        )}
      </div>
    </Modal>
  )
}

/** Manual entry: type the code from the guest's screen, or find the guest by name. */
function ManualEntry({ eventId, onPick }: { eventId: string; onPick: (target: CheckInTarget) => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const search = useCheckInSearch(eventId, name)

  function submitCode(e: FormEvent) {
    e.preventDefault()
    if (code.trim()) onPick({ code: code.trim() })
  }

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 text-stone-900 sm:p-5">
      <form onSubmit={submitCode} className="flex gap-2">
        <TextField
          id="checkin-code"
          label={t('checkin.codeLabel')}
          icon={QrCode}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          wrapperClassName="min-w-0 flex-1"
        />
        <Button type="submit" size="lg" className="h-14">
          {t('checkin.find')}
        </Button>
      </form>
      <TextField
        id="checkin-name"
        type="search"
        label={t('checkin.searchLabel')}
        icon={Search}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <ul className="-mx-2 divide-y divide-brand-100 empty:hidden">
        {name.trim().length >= 2 &&
          search.data?.map((hit) => (
            <li key={hit.invitationId}>
              <button
                type="button"
                onClick={() => onPick({ invitationId: hit.invitationId })}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-brand-50 active:bg-brand-100"
              >
                <Avatar name={hit.guestName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-brand-950">{hit.guestName}</span>
                  <span className="text-xs text-stone-500">
                    {hit.type === 'Group'
                      ? t('guests.groupOf', { n: hit.numberOfPeople })
                      : t('guests.type.Individual')}
                  </span>
                </span>
                {hit.checkedIn && (
                  <Badge tone="success" icon={CircleCheck}>
                    {t('checkin.checkedIn')}
                  </Badge>
                )}
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}

function MyActivity({ eventId }: { eventId: string }) {
  const { t, i18n } = useTranslation()
  const activity = useMyActivity(eventId, true)
  return (
    <div className="rounded-3xl bg-white p-4 text-stone-900 sm:p-5">
      {activity.data?.length === 0 && (
        <p className="py-6 text-center text-sm text-stone-500">{t('checkin.noActivity')}</p>
      )}
      <ol className="-mx-2 divide-y divide-brand-100 empty:hidden">
        {activity.data?.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-2 py-3 text-sm">
            <time className="w-12 shrink-0 font-semibold text-brand-700 tabular-nums">
              {time(item.checkedInAt, i18n.language)}
            </time>
            <span className="min-w-0 flex-1 truncate font-medium text-brand-950">{item.guestName}</span>
            <span className="text-stone-500">{t('stats.peopleCount', { count: item.numberOfPeople })}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const tabs: { key: Tab; icon: LucideIcon }[] = [
  { key: 'scan', icon: QrCode },
  { key: 'manual', icon: Search },
  { key: 'mine', icon: History },
]

/**
 * Staff at the entrance, full screen and high contrast: scan or find the guest, confirm, next.
 * Owner can use it too. Each result vibrates differently (success, repeat, invalid).
 */
export function ScannerPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const summary = useCheckInSummary(id)
  const checkIn = useCheckIn(id)
  const [tab, setTab] = useState<Tab>('scan')
  const [sheet, setSheet] = useState<Sheet | null>(null)

  const show = useCallback((next: Sheet) => {
    if (next.kind === 'done') vibrate(next.result.alreadyCheckedIn ? 'repeat' : 'success')
    else if (next.kind === 'found' && next.result.alreadyCheckedIn) vibrate('repeat')
    else if (next.kind === 'error') vibrate('error')
    setSheet(next)
  }, [])

  const open = useCallback(
    async (target: CheckInTarget) => {
      setSheet({ kind: 'loading' })
      try {
        if ('code' in target) {
          show({ kind: 'found', target, result: await lookup(id, target.code) })
        } else {
          // Picked by name: the search already showed who it is, so commit straight away.
          show({ kind: 'done', result: await checkIn.mutateAsync(target) })
        }
      } catch (error) {
        show({ kind: 'error', error })
      }
    },
    [id, checkIn, show],
  )

  function confirm() {
    if (sheet?.kind !== 'found') return
    checkIn.mutate(sheet.target, {
      onSuccess: (result) => show({ kind: 'done', result }),
      onError: (error) => show({ kind: 'error', error }),
    })
  }

  const scanned = useCallback((text: string) => void open({ code: text }), [open])
  const people = summary.data?.people ?? 0
  const arrived = summary.data?.checkedInPeople ?? 0

  return (
    <section className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3 py-2">
        <Link
          to="/staff"
          aria-label={t('staffArea.title')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-white">{event.data?.name ?? '…'}</h1>
          {summary.data && (
            <p className="truncate text-sm text-white/70">
              {t('checkin.counter', {
                arrived: summary.data.checkedInPeople,
                total: summary.data.people,
                invitations: summary.data.checkedInInvitations,
                allInvitations: summary.data.invitations,
              })}
            </p>
          )}
        </div>
        {summary.data && (
          <p className="shrink-0 rounded-full bg-success-500/20 px-3 py-1 text-sm font-semibold text-success-100 tabular-nums">
            {arrived}/{people}
          </p>
        )}
      </header>
      {summary.data && (
        <div aria-hidden className="mt-1 mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-success-500 transition-[width] duration-700 ease-out-soft"
            style={{ width: `${people > 0 ? (arrived / people) * 100 : 0}%` }}
          />
        </div>
      )}

      <div role="tabpanel" className="flex-1">
        {/* The scanner stays mounted while a result shows: the camera keeps running for the next guest. */}
        <div hidden={tab !== 'scan'}>
          <QrScanner paused={sheet !== null || tab !== 'scan'} onDetect={scanned} />
        </div>
        {tab === 'manual' && <ManualEntry eventId={id} onPick={(target) => void open(target)} />}
        {tab === 'mine' && <MyActivity eventId={id} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-stone-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div
          role="tablist"
          aria-label={t('checkin.modes')}
          className="mx-auto grid max-w-lg grid-cols-3 gap-2"
        >
          {tabs.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-semibold transition-colors active:scale-[0.97]',
                tab === key ? 'bg-white text-stone-950' : 'text-white/75 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon aria-hidden className="size-6" />
              {t(`checkin.tab.${key}`)}
            </button>
          ))}
        </div>
      </nav>

      {sheet && (
        <ResultSheet
          sheet={sheet}
          onConfirm={confirm}
          confirming={checkIn.isPending}
          onNext={() => setSheet(null)}
        />
      )}
    </section>
  )
}
