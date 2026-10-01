import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { PageHeader } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Loading } from '@/components/ui/Spinner'
import { useEvent } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import { EventPaymentSection } from './EventPaymentSection'

/** "Pembayaran" menu of the selected event: its package and payment (also shown on the event page). */
export function EventPaymentsPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)

  return (
    <section className="mx-auto max-w-3xl py-6 sm:py-10">
      <PageHeader eyebrow={event.data?.name} title={t('nav.payments')} />
      {event.isPending ? (
        <Loading />
      ) : event.isError ? (
        <Notice tone="danger">{errorMessage(t, event.error)}</Notice>
      ) : event.data.status === 'Cancelled' ? (
        <Notice>{t('settings.cancelledNoPayment')}</Notice>
      ) : (
        <EventPaymentSection event={event.data} />
      )}
    </section>
  )
}
