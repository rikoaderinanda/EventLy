import { Check, Copy, Landmark, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Loading } from '@/components/ui/Spinner'
import { errorMessage } from '@/shared/lib/errors'
import { formatMoney, useTransfer } from './api'

function CopyRow({
  label,
  value,
  copyValue,
  strong,
}: {
  label: string
  value: string
  copyValue?: string
  strong?: boolean
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-stone-500">{label}</p>
        <p
          className={
            strong ? 'text-lg font-semibold text-brand-950 tabular-nums' : 'font-medium text-brand-950'
          }
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(copyValue ?? value).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
          })
        }
        aria-label={t('payments.transfer.copy', { what: label })}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
      >
        {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        {copied ? t('guests.copied') : t('payments.transfer.copyShort')}
      </button>
    </div>
  )
}

/**
 * Bank transfer instructions for a pending manual checkout (Q-73): where to pay, the exact amount, the
 * reference for the transfer note, and where to send the proof. Root then confirms and the event goes live.
 */
export function TransferInstructions({ paymentId }: { paymentId: string }) {
  const { t, i18n } = useTranslation()
  const transfer = useTransfer(paymentId)

  if (transfer.isPending) return <Loading />
  if (transfer.isError) return <Notice tone="danger">{errorMessage(t, transfer.error)}</Notice>
  const data = transfer.data

  return (
    <Card as="section" aria-labelledby="transfer-title" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Landmark aria-hidden className="size-5" />
        </span>
        <div>
          <h2 id="transfer-title" className="text-card">
            {t('payments.transfer.title')}
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">{t('payments.transfer.subtitle')}</p>
        </div>
      </div>

      <ol className="space-y-1 text-sm text-stone-700">
        <li>1. {t('payments.transfer.step1')}</li>
        <li>2. {t('payments.transfer.step2')}</li>
        <li>3. {t('payments.transfer.step3', { contact: data.confirmationContact })}</li>
      </ol>

      <div className="rounded-2xl bg-brand-50 px-4">
        <CopyRow label={t('payments.transfer.bank')} value={data.bankName} />
        <CopyRow
          label={t('payments.transfer.accountNumber')}
          value={data.accountNumber}
          copyValue={data.accountNumber.replace(/[\s-]/g, '')}
          strong
        />
        <CopyRow label={t('payments.transfer.accountHolder')} value={data.accountHolder} />
        <CopyRow
          label={t('payments.transfer.amount')}
          value={formatMoney(data.amount, data.currency, i18n.language)}
          copyValue={String(data.amount)}
          strong
        />
        <CopyRow label={t('payments.transfer.reference')} value={data.reference} strong />
      </div>

      <Notice tone="warning">{t('payments.transfer.referenceHint', { reference: data.reference })}</Notice>

      <p className="flex items-start gap-2 text-sm text-stone-600">
        <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
        {t('payments.transfer.confirm', { contact: data.confirmationContact })}
      </p>
      {data.expiresAt && (
        <p className="text-xs text-stone-500">
          {t('payments.transfer.deadline', { date: new Date(data.expiresAt).toLocaleString(i18n.language) })}
        </p>
      )}
    </Card>
  )
}
