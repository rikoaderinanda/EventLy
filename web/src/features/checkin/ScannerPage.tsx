import { useCallback, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/problem'
import { useEvent } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import {
  lookup,
  useCheckIn,
  useCheckInSearch,
  useCheckInSummary,
  useMyActivity,
  type CheckInResult,
  type CheckInTarget,
} from './api'
import { StaffPhotoButton } from '@/features/photos/StaffPhotoButton'
import { QrScanner } from './QrScanner'

type Sheet =
  | { kind: 'loading' }
  | { kind: 'found'; target: CheckInTarget; result: CheckInResult }
  | { kind: 'done'; result: CheckInResult }
  | { kind: 'error'; error: unknown }

function time(value: string | null, locale: string) {
  return value ? new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''
}

/**
 * The result of a scan, before and after committing: green for a new check-in, amber for a repeat
 * scan, red for an invalid invitation. Large buttons for one-handed use at the entrance.
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
    return <p className="py-6 text-center text-stone-500">{t('common.loading')}</p>

  if (sheet.kind === 'error') {
    const notFound = sheet.error instanceof ApiError && sheet.error.status === 404
    return (
      <div role="alert" className="space-y-4 rounded-xl bg-red-50 p-5 text-center">
        <p className="text-lg font-semibold text-red-800">
          {notFound ? t('checkin.invalidTitle') : t('checkin.errorTitle')}
        </p>
        <p className="text-sm text-red-800">{errorMessage(t, sheet.error)}</p>
        <NextButton onNext={onNext} />
      </div>
    )
  }

  const { result } = sheet
  const repeat = result.alreadyCheckedIn
  const done = sheet.kind === 'done'
  const tone = repeat
    ? 'bg-amber-50 text-amber-900'
    : done
      ? 'bg-emerald-50 text-emerald-900'
      : 'bg-white text-stone-900'

  return (
    <div role="status" className={`space-y-3 rounded-xl border border-brand-100 p-5 text-center ${tone}`}>
      {done && !repeat && <p className="text-lg font-semibold">{t('checkin.success')}</p>}
      {repeat && (
        <p className="text-lg font-semibold">
          {t('checkin.already', {
            time: time(result.checkedInAt, i18n.language),
            by: result.checkedInBy ?? '',
          })}
        </p>
      )}
      <p className="text-2xl font-semibold">{result.guestName}</p>
      <p className="text-sm">
        {result.type === 'Group'
          ? t('guests.groupOf', { n: result.numberOfPeople })
          : t('guests.type.Individual')}
      </p>
      {result.warnings.map((w) => (
        <p key={w} className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          ⚠ {t(`checkin.warning.${w}`)}
        </p>
      ))}
      {sheet.kind === 'found' && !repeat && (
        <button
          type="button"
          disabled={confirming}
          onClick={onConfirm}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white disabled:opacity-50"
        >
          {t('checkin.confirm')}
        </button>
      )}
      {(done || repeat) && <StaffPhotoButton key={result.invitationId} invitationId={result.invitationId} />}
      {(done || repeat) && <NextButton onNext={onNext} />}
      {sheet.kind === 'found' && !repeat && (
        <button type="button" onClick={onNext} className="text-sm text-stone-600 underline">
          {t('checkin.cancel')}
        </button>
      )}
    </div>
  )
}

function NextButton({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onNext}
      className="w-full rounded-xl bg-brand-700 py-3 font-semibold text-white"
    >
      {t('checkin.next')}
    </button>
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
    <div className="space-y-4">
      <form onSubmit={submitCode} className="flex gap-2">
        <label htmlFor="checkin-code" className="sr-only">
          {t('checkin.codeLabel')}
        </label>
        <input
          id="checkin-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('checkin.codeLabel')}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-3"
        />
        <button type="submit" className="rounded-md bg-brand-700 px-4 font-medium text-white">
          {t('checkin.find')}
        </button>
      </form>
      <div>
        <label htmlFor="checkin-name" className="text-sm font-medium text-stone-700">
          {t('checkin.searchLabel')}
        </label>
        <input
          id="checkin-name"
          type="search"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-3"
        />
      </div>
      <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white empty:hidden">
        {name.trim().length >= 2 &&
          search.data?.map((hit) => (
            <li key={hit.invitationId}>
              <button
                type="button"
                onClick={() => onPick({ invitationId: hit.invitationId })}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span>
                  <span className="block font-medium text-stone-800">{hit.guestName}</span>
                  <span className="text-xs text-stone-500">
                    {hit.type === 'Group'
                      ? t('guests.groupOf', { n: hit.numberOfPeople })
                      : t('guests.type.Individual')}
                  </span>
                </span>
                {hit.checkedIn && <span className="text-xs text-emerald-700">{t('checkin.checkedIn')}</span>}
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
  if (activity.data?.length === 0) return <p className="text-sm text-stone-500">{t('checkin.noActivity')}</p>
  return (
    <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white">
      {activity.data?.map((item) => (
        <li key={item.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
          <span className="text-stone-800">
            {item.guestName} <span className="text-stone-500">({item.numberOfPeople})</span>
          </span>
          <span className="text-stone-500">{time(item.checkedInAt, i18n.language)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Staff at the entrance: scan or find the guest, confirm, next. Owner can use it too. */
export function ScannerPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const summary = useCheckInSummary(id)
  const checkIn = useCheckIn(id)
  const [tab, setTab] = useState<'scan' | 'manual' | 'mine'>('scan')
  const [sheet, setSheet] = useState<Sheet | null>(null)

  const open = useCallback(
    async (target: CheckInTarget) => {
      setSheet({ kind: 'loading' })
      try {
        if ('code' in target) {
          setSheet({ kind: 'found', target, result: await lookup(id, target.code) })
        } else {
          // Picked by name: the search already showed who it is, so commit straight away.
          setSheet({ kind: 'done', result: await checkIn.mutateAsync(target) })
        }
      } catch (error) {
        setSheet({ kind: 'error', error })
      }
    },
    [id, checkIn],
  )

  function confirm() {
    if (sheet?.kind !== 'found') return
    checkIn.mutate(sheet.target, {
      onSuccess: (result) => setSheet({ kind: 'done', result }),
      onError: (error) => setSheet({ kind: 'error', error }),
    })
  }

  const scanned = useCallback((text: string) => void open({ code: text }), [open])

  return (
    <section className="mx-auto max-w-md space-y-4 py-4">
      <Link to="/staff" className="text-sm text-brand-700 underline">
        ← {t('staffArea.title')}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-900">{event.data?.name}</h1>
        {summary.data && (
          <p className="text-sm text-stone-600">
            {t('checkin.counter', {
              arrived: summary.data.checkedInPeople,
              total: summary.data.people,
              invitations: summary.data.checkedInInvitations,
              allInvitations: summary.data.invitations,
            })}
          </p>
        )}
      </div>

      {sheet && (
        <ResultSheet
          sheet={sheet}
          onConfirm={confirm}
          confirming={checkIn.isPending}
          onNext={() => setSheet(null)}
        />
      )}
      {/* Hidden, not unmounted, while a result shows: the camera keeps running for the next guest. */}
      <div hidden={sheet !== null} className="space-y-4">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-brand-100 p-1 text-sm">
          {(['scan', 'manual', 'mine'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="rounded-md py-2 font-medium text-brand-900 aria-selected:bg-white aria-selected:shadow-sm"
            >
              {t(`checkin.tab.${key}`)}
            </button>
          ))}
        </div>
        {tab === 'scan' && <QrScanner paused={sheet !== null} onDetect={scanned} />}
        {tab === 'manual' && <ManualEntry eventId={id} onPick={(target) => void open(target)} />}
        {tab === 'mine' && <MyActivity eventId={id} />}
      </div>
    </section>
  )
}
