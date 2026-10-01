import { ArrowLeft, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Feedback'
import { Loading } from '@/components/ui/Spinner'
import { useEvent } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import { useQrSheet } from './api'

/**
 * Printable QR sheet (decision Q-27): one card per active invitation, to cut out or hand over. Printed
 * from the browser like the receipt, so no PDF library is needed. The SVG comes from our own API.
 */
export function QrSheetPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const sheet = useQrSheet(id)

  if (sheet.isPending) return <Loading className="py-20" />
  if (sheet.isError) return <Notice tone="danger">{errorMessage(t, sheet.error)}</Notice>

  return (
    <section className="mx-auto max-w-5xl space-y-5 py-6 sm:py-10 print:max-w-none print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <ButtonLink
          to={`/app/events/${id}/guests`}
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          className="-ml-3"
        >
          {t('guests.title')}
        </ButtonLink>
        <Button icon={Printer} onClick={() => window.print()} disabled={sheet.data.length === 0}>
          {t('payments.print')}
        </Button>
      </div>
      <h1 className="text-section print:text-xl">
        {t('guests.qrSheetTitle', { event: event.data?.name ?? '' })}
      </h1>
      {sheet.data.length === 0 && <EmptyState kind="guests" title={t('guests.qrSheetEmpty')} />}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {sheet.data.map((item) => (
          <li
            key={item.invitationId}
            className="flex break-inside-avoid flex-col items-center gap-2 rounded-2xl border border-brand-100 bg-white p-4 text-center shadow-soft print:rounded-lg print:border-stone-300 print:shadow-none"
          >
            {/* Trusted markup: rendered by our API from the invitation URL (QRCoder), no user input. */}
            <div className="w-full max-w-40" dangerouslySetInnerHTML={{ __html: item.svg }} />
            <p className="font-semibold text-brand-950">{item.guestName}</p>
            <p className="text-xs text-stone-600">
              {item.type === 'Group'
                ? t('guests.groupOf', { n: item.numberOfPeople })
                : t('guests.type.Individual')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
