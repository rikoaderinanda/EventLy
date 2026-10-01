import {
  CircleCheck,
  CircleDashed,
  CircleX,
  MailOpen,
  Mails,
  type LucideIcon,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { RsvpBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Feedback'
import { Skeleton } from '@/components/ui/Spinner'
import { EventPageHeader } from '@/features/events/EventPageHeader'
import type { RsvpStatus } from '@/features/invitation/api'
import { errorMessage } from '@/shared/lib/errors'
import { useRsvps, useRsvpSummary } from './api'

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone: string
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-soft">
      <Icon aria-hidden className={cn('mb-2 size-5', tone)} />
      <p className="text-2xl font-semibold text-brand-950 tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-stone-500">{label}</p>
    </div>
  )
}

const filters: (RsvpStatus | '')[] = ['', 'Attending', 'NotAttending', 'Pending']

/** Owner/Admin: who answered what, and how many people to expect. */
export function RsvpPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const [status, setStatus] = useState<RsvpStatus | ''>('')
  const summary = useRsvpSummary(id)
  const rows = useRsvps(id, status)

  return (
    <section className="mx-auto max-w-5xl space-y-5 py-6 sm:py-10">
      <EventPageHeader eventId={id} title={t('responses.rsvpTitle')} subtitle={t('responses.rsvpHint')} />

      {summary.isPending && <Skeleton className="h-28 rounded-2xl" />}
      {summary.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            icon={Mails}
            tone="text-brand-500"
            label={t('responses.invitations')}
            value={summary.data.invitations}
          />
          <Stat
            icon={MailOpen}
            tone="text-sky-700"
            label={t('responses.opened')}
            value={summary.data.opened}
          />
          <Stat
            icon={CircleCheck}
            tone="text-success-500"
            label={t('responses.status.Attending')}
            value={summary.data.attending}
          />
          <Stat
            icon={CircleX}
            tone="text-danger-500"
            label={t('responses.status.NotAttending')}
            value={summary.data.notAttending}
          />
          <Stat
            icon={CircleDashed}
            tone="text-stone-400"
            label={t('responses.status.Pending')}
            value={summary.data.pending}
          />
          <Stat
            icon={UsersRound}
            tone="text-gold-500"
            label={t('responses.expectedPeople')}
            value={summary.data.expectedPeople}
          />
        </div>
      )}

      <div
        role="group"
        aria-label={t('responses.filter')}
        className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        {filters.map((value) => (
          <button
            key={value || 'all'}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={cn(
              'h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
              status === value
                ? 'bg-brand-900 text-white'
                : 'bg-white text-stone-600 ring-1 ring-brand-100 hover:ring-brand-200',
            )}
          >
            {value ? t(`responses.status.${value}`) : t('responses.allAnswers')}
          </button>
        ))}
      </div>

      {(rows.isError || summary.isError) && (
        <Notice tone="danger">{errorMessage(t, rows.error ?? summary.error)}</Notice>
      )}
      {rows.data?.length === 0 && (
        <Card>
          <EmptyState kind="guests" title={t('responses.empty')} />
        </Card>
      )}
      {rows.data && rows.data.length > 0 && (
        <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
          {rows.data.map((row) => (
            <li key={row.invitationId} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <Avatar name={row.guestName} size="sm" />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/app/events/${id}/guests/${row.guestId}`}
                  className="block truncate font-medium text-brand-950 hover:text-brand-700 hover:underline"
                >
                  {row.guestName}
                </Link>
                <p className="truncate text-xs text-stone-500">
                  {row.guestType === 'Group'
                    ? t('guests.groupOf', { n: row.numberOfPeople })
                    : t('guests.type.Individual')}
                  {' · '}
                  {row.openedAt
                    ? t('responses.openedOn', {
                        date: new Date(row.openedAt).toLocaleDateString(i18n.language),
                      })
                    : t('responses.notOpened')}
                  {row.invitationStatus === 'Revoked' && ` · ${t('guests.status.Revoked')}`}
                </p>
              </div>
              <RsvpBadge status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
