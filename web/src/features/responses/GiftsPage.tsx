import { Gift, Landmark, Plus, Trash2, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, SectionHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Feedback'
import { Select, TextArea, TextField } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Spinner'
import { isEditable, useEvent } from '@/features/events/api'
import { EventPageHeader } from '@/features/events/EventPageHeader'
import type { GiftAccount, GiftAccountKind } from '@/features/invitation/api'
import { formatMoney } from '@/features/payments/api'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import { useEventGifts, useGiftConfirmations, useSaveEventGifts, type EventGifts } from './api'

const maxAccounts = 5
const emptyAccount: GiftAccount = { kind: 'Bank', provider: '', accountNumber: '', accountHolder: '' }

function GiftsForm({
  eventId,
  initial,
  readOnly,
}: {
  eventId: string
  initial: EventGifts
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const save = useSaveEventGifts(eventId)
  const [accounts, setAccounts] = useState<GiftAccount[]>(initial.accounts)
  const [address, setAddress] = useState(initial.address ?? '')
  const errors = fieldErrors(save.error)

  function update(index: number, change: Partial<GiftAccount>) {
    setAccounts(accounts.map((a, i) => (i === index ? { ...a, ...change } : a)))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate({ accounts, address: address.trim() || null })
  }

  return (
    <Card as="section">
      <form onSubmit={submit} className="space-y-5">
        <SectionHeader
          title={t('responses.accountsTitle')}
          level={3}
          className="mb-0"
          actions={
            !readOnly &&
            accounts.length < maxAccounts && (
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => setAccounts([...accounts, emptyAccount])}
              >
                {t('responses.addAccount')}
              </Button>
            )
          }
        />
        <fieldset disabled={readOnly} className="space-y-4">
          {accounts.length === 0 && <p className="text-sm text-stone-500">{t('responses.noAccounts')}</p>}
          {accounts.map((a, i) => {
            const Icon = a.kind === 'Bank' ? Landmark : Wallet
            const numberError = errors[`accounts[${i}].AccountNumber`]
            return (
              <fieldset
                key={i}
                aria-label={t('responses.accountN', { n: i + 1 })}
                className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
                    <Icon aria-hidden className="size-4 text-brand-600" />
                    {t('responses.accountN', { n: i + 1 })}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
                    onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}
                  >
                    {t('responses.removeAccount')}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    id={`account-${i}-kind`}
                    label={t('responses.kind')}
                    value={a.kind}
                    onChange={(e) => update(i, { kind: e.target.value as GiftAccountKind })}
                  >
                    <option value="Bank">{t('responses.kindBank')}</option>
                    <option value="EWallet">{t('responses.kindEWallet')}</option>
                  </Select>
                  <TextField
                    id={`account-${i}-provider`}
                    label={t('responses.provider')}
                    required
                    maxLength={60}
                    placeholder="BSI, BCA, GoPay…"
                    value={a.provider}
                    onChange={(e) => update(i, { provider: e.target.value })}
                  />
                  <TextField
                    id={`account-${i}-number`}
                    label={t('responses.accountNumber')}
                    required
                    maxLength={40}
                    inputMode="numeric"
                    value={a.accountNumber}
                    onChange={(e) => update(i, { accountNumber: e.target.value })}
                    // The server names it "Accounts[0].AccountNumber"; fieldErrors lowercases only the first letter.
                    error={numberError}
                  />
                  <TextField
                    id={`account-${i}-holder`}
                    label={t('responses.accountHolder')}
                    required
                    maxLength={100}
                    value={a.accountHolder}
                    onChange={(e) => update(i, { accountHolder: e.target.value })}
                  />
                </div>
              </fieldset>
            )
          })}
          <TextArea
            id="gift-address"
            label={t('responses.giftAddress')}
            rows={3}
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </fieldset>
        {save.isError && <Notice tone="danger">{errorMessage(t, save.error)}</Notice>}
        {save.isSuccess && <Notice tone="success">{t('common.saved')}</Notice>}
        {!readOnly && (
          <Button type="submit" loading={save.isPending} block="mobile">
            {t('common.save')}
          </Button>
        )}
      </form>
    </Card>
  )
}

/** Owner/Admin: amplop digital accounts and address (Q-41), and the guests' gift confirmations. */
export function GiftsPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const gifts = useEventGifts(id)
  const confirmations = useGiftConfirmations(id)
  const total = (confirmations.data ?? []).reduce((sum, c) => sum + (c.amount ?? 0), 0)

  return (
    <section className="mx-auto max-w-5xl space-y-5 py-6 sm:py-10">
      <EventPageHeader eventId={id} title={t('responses.giftsTitle')} subtitle={t('responses.giftsHint')} />
      {gifts.isError && <Notice tone="danger">{errorMessage(t, gifts.error)}</Notice>}
      <div className="grid items-start gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {gifts.isPending && <Loading />}
          {gifts.data && event.data && (
            <GiftsForm eventId={id} initial={gifts.data} readOnly={!isEditable(event.data.status)} />
          )}
        </div>

        <Card as="section" className="lg:col-span-2">
          <SectionHeader
            title={t('responses.confirmationsTitle')}
            description={
              confirmations.data && confirmations.data.length > 0
                ? t('responses.confirmationsTotal', {
                    count: confirmations.data.length,
                    amount: formatMoney(total, 'IDR', i18n.language),
                  })
                : undefined
            }
            level={3}
          />
          {confirmations.data?.length === 0 && (
            <EmptyState icon={Gift} title={t('responses.noConfirmations')} className="py-4" />
          )}
          <ul className="-mx-2 divide-y divide-brand-100 empty:hidden">
            {confirmations.data?.map((c) => (
              <li key={c.id} className="flex gap-3 px-2 py-3 text-sm">
                <Avatar name={c.senderName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-950">
                    {c.senderName} <span className="font-normal text-stone-500">({c.guestName})</span>
                  </p>
                  <p className="text-stone-600">
                    {c.amount != null ? (
                      <span className="font-semibold text-gold-700">
                        {formatMoney(c.amount, 'IDR', i18n.language)}
                      </span>
                    ) : (
                      t('responses.noAmount')
                    )}
                    {c.note && ` · ${c.note}`}
                  </p>
                  <p className="text-xs text-stone-400">
                    {new Date(c.createdAt).toLocaleString(i18n.language)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  )
}
