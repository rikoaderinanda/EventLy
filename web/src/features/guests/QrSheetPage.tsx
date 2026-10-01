import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
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

  if (sheet.isPending) return <p className="py-8 text-stone-500">{t('common.loading')}</p>
  if (sheet.isError) return <p className="py-8 text-red-700">{errorMessage(t, sheet.error)}</p>

  return (
    <section className="mx-auto max-w-5xl space-y-4 py-8 print:max-w-none print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to={`/app/events/${id}/guests`} className="text-sm text-brand-700 underline">
          ← {t('guests.title')}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={sheet.data.length === 0}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t('payments.print')}
        </button>
      </div>
      <h1 className="text-xl font-semibold text-brand-900">
        {t('guests.qrSheetTitle', { event: event.data?.name ?? '' })}
      </h1>
      {sheet.data.length === 0 && <p className="text-stone-600">{t('guests.qrSheetEmpty')}</p>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {sheet.data.map((item) => (
          <li
            key={item.invitationId}
            className="flex break-inside-avoid flex-col items-center gap-2 rounded-lg border border-stone-300 p-3 text-center"
          >
            {/* Trusted markup: rendered by our API from the invitation URL (QRCoder), no user input. */}
            <div className="w-full max-w-40" dangerouslySetInnerHTML={{ __html: item.svg }} />
            <p className="font-medium text-stone-900">{item.guestName}</p>
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
