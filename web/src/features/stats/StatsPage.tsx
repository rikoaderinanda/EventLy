import {
  CircleCheck,
  FileSpreadsheet,
  Gift,
  Images,
  MailOpen,
  MessageCircleHeart,
  ScanLine,
  UserCog,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { CheckInChart, RsvpBreakdown } from '@/components/event/Charts'
import { StatisticCard } from '@/components/event/StatisticCard'
import { ButtonLink } from '@/components/ui/Button'
import { Card, PageHeader, SectionHeader } from '@/components/ui/Card'
import { Notice, ProgressBar, ProgressRing } from '@/components/ui/Feedback'
import { Loading } from '@/components/ui/Spinner'
import { useEvent, useEventStats } from '@/features/events/api'
import { formatMoney } from '@/features/payments/api'
import { errorMessage } from '@/shared/lib/errors'

/** Statistics of one event (Q-60): reach, answers, attendance, and what guests left behind. */
export function StatsPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const stats = useEventStats(id)

  if (stats.isPending || event.isPending) return <Loading className="py-20" />
  if (stats.isError) return <Notice tone="danger">{errorMessage(t, stats.error)}</Notice>
  if (event.isError) return <Notice tone="danger">{errorMessage(t, event.error)}</Notice>
  const { guests, rsvp, checkIns, wishes, gifts, photos, staff } = stats.data

  return (
    <section className="mx-auto max-w-6xl space-y-6 py-6 sm:space-y-8 sm:py-10">
      <PageHeader
        eyebrow={event.data.name}
        title={t('stats.title')}
        subtitle={t('stats.subtitle')}
        actions={
          <ButtonLink
            to={`/app/events/${id}/reports`}
            variant="secondary"
            icon={FileSpreadsheet}
            block="mobile"
          >
            {t('reports.open')}
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatisticCard
          icon={Users}
          label={t('dashboard.totalGuests')}
          value={guests.people}
          caption={t('dashboard.invitations', { count: guests.invitations })}
        />
        <StatisticCard
          icon={MailOpen}
          label={t('stats.opened')}
          value={guests.opened}
          tone="info"
          caption={t('stats.ofInvitations', { count: guests.invitations })}
          visual={
            <ProgressRing
              value={guests.opened}
              max={guests.invitations}
              label={t('stats.opened')}
              size={52}
              stroke={6}
            />
          }
        />
        <StatisticCard
          icon={CircleCheck}
          label={t('stats.attendingPeople')}
          value={rsvp.attendingPeople}
          tone="success"
          caption={t('dashboard.ofPeople', { count: guests.people })}
        />
        <StatisticCard
          icon={ScanLine}
          label={t('dashboard.checkedIn')}
          value={checkIns.people}
          tone="success"
          visual={
            <ProgressRing
              value={checkIns.people}
              max={guests.people}
              label={t('dashboard.checkedIn')}
              size={52}
              stroke={6}
              tone="success"
            />
          }
          caption={t('dashboard.ofPeople', { count: guests.people })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionHeader title={t('stats.rsvpTitle')} description={t('stats.rsvpHint')} level={3} />
          <RsvpBreakdown attending={rsvp.attending} notAttending={rsvp.notAttending} pending={rsvp.pending} />
        </Card>
        <Card className="lg:col-span-3">
          <SectionHeader title={t('stats.checkInsByHour')} description={t('stats.checkInsHint')} level={3} />
          <CheckInChart byHour={checkIns.byHour} timeZone={event.data.timeZone} />
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatisticCard icon={MessageCircleHeart} label={t('dashboard.wishes')} value={wishes} tone="gold" />
        <StatisticCard
          icon={Gift}
          label={t('stats.gifts')}
          value={gifts.confirmations}
          tone="gold"
          caption={gifts.amount > 0 ? formatMoney(gifts.amount, 'IDR', i18n.language) : undefined}
        />
        <StatisticCard
          icon={Images}
          label={t('stats.photos')}
          value={photos.count}
          caption={photos.limit ? t('dashboard.ofLimit', { limit: photos.limit }) : undefined}
        />
        <StatisticCard icon={UserCog} label={t('stats.staff')} value={staff} />
      </div>

      {guests.peopleLimit && (
        <Card>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium text-brand-950">{t('stats.quota')}</span>
            <span className="text-stone-500 tabular-nums">
              {guests.people} / {guests.peopleLimit}
            </span>
          </div>
          <ProgressBar value={guests.people} max={guests.peopleLimit} label={t('stats.quota')} />
        </Card>
      )}
    </section>
  )
}
