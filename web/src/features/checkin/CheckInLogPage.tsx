import { QrCode, ScanLine, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice, ProgressRing } from '@/components/ui/Feedback'
import { Skeleton } from '@/components/ui/Spinner'
import { useSession } from '@/features/auth/session-store'
import { EventPageHeader } from '@/features/events/EventPageHeader'
import { errorMessage } from '@/shared/lib/errors'
import { useCheckInLog, useCheckInSummary } from './api'

/** Owner/Admin: arrivals so far and who checked whom in. Refreshes by itself during the event. */
export function CheckInLogPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const role = useSession((s) => s.user?.role)
  const summary = useCheckInSummary(id)
  const log = useCheckInLog(id)

  return (
    <section className="mx-auto max-w-4xl space-y-5 py-6 sm:py-10">
      <EventPageHeader
        eventId={id}
        title={t('checkin.logTitle')}
        subtitle={t('checkin.logEntry')}
        actions={
          role === 'Owner' && (
            <ButtonLink to={`/staff/events/${id}`} icon={ScanLine} block="mobile">
              {t('checkin.openScanner')}
            </ButtonLink>
          )
        }
      />

      {summary.isPending && <Skeleton className="h-28 rounded-2xl" />}
      {summary.data && (
        <Card className="flex items-center gap-5">
          <ProgressRing
            value={summary.data.checkedInPeople}
            max={summary.data.people}
            label={t('dashboard.checkedIn')}
            size={84}
            stroke={9}
            tone="success"
          />
          <div className="min-w-0">
            <p className="text-3xl font-semibold text-brand-950 tabular-nums">
              {summary.data.checkedInPeople}
              <span className="text-lg font-normal text-stone-400"> / {summary.data.people}</span>
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {t('checkin.counter', {
                arrived: summary.data.checkedInPeople,
                total: summary.data.people,
                invitations: summary.data.checkedInInvitations,
                allInvitations: summary.data.invitations,
              })}
            </p>
          </div>
        </Card>
      )}

      {(log.isError || summary.isError) && (
        <Notice tone="danger">{errorMessage(t, log.error ?? summary.error)}</Notice>
      )}
      {log.data?.length === 0 && (
        <Card>
          <EmptyState icon={ScanLine} title={t('checkin.noCheckIns')} />
        </Card>
      )}
      {log.data && log.data.length > 0 && (
        <ol className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
          {log.data.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <time
                dateTime={item.checkedInAt}
                className="w-12 shrink-0 text-sm font-semibold text-brand-700 tabular-nums"
              >
                {new Date(item.checkedInAt).toLocaleTimeString(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              <Avatar name={item.guestName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-brand-950">
                  {item.guestName}{' '}
                  <span className="font-normal text-stone-500">
                    ({t('stats.peopleCount', { count: item.numberOfPeople })})
                  </span>
                </p>
                <p className="truncate text-xs text-stone-500">{item.staffName}</p>
              </div>
              <Badge tone="neutral" icon={item.method === 'Scan' ? QrCode : Search}>
                {t(`checkin.method.${item.method}`)}
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
