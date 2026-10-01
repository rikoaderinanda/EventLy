import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { useEvent } from './api'

/** Title block of an event's sub-page: back to the event, the event name above the page title. */
export function EventPageHeader({
  eventId,
  title,
  subtitle,
  actions,
}: {
  eventId: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  const event = useEvent(eventId)
  return (
    <>
      <ButtonLink
        to={`/app/events/${eventId}`}
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        className="mb-3 -ml-3"
      >
        {event.data?.name ?? t('events.title')}
      </ButtonLink>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
    </>
  )
}
