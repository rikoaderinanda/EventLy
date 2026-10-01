import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { isEditable, useEvent } from '@/features/events/api'
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
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-brand-100 bg-white p-5">
      <fieldset disabled={readOnly} className="space-y-4">
        {accounts.map((a, i) => (
          <fieldset
            key={i}
            aria-label={t('responses.accountN', { n: i + 1 })}
            className="grid gap-2 rounded-md border border-stone-200 p-3 sm:grid-cols-2"
          >
            <label className="text-sm">
              <span className="text-stone-700">{t('responses.kind')}</span>
              <select
                value={a.kind}
                onChange={(e) => update(i, { kind: e.target.value as GiftAccountKind })}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
              >
                <option value="Bank">{t('responses.kindBank')}</option>
                <option value="EWallet">{t('responses.kindEWallet')}</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-stone-700">{t('responses.provider')}</span>
              <input
                required
                maxLength={60}
                placeholder="BSI, BCA, GoPay…"
                value={a.provider}
                onChange={(e) => update(i, { provider: e.target.value })}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-stone-700">{t('responses.accountNumber')}</span>
              <input
                required
                maxLength={40}
                inputMode="numeric"
                value={a.accountNumber}
                onChange={(e) => update(i, { accountNumber: e.target.value })}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
              {/* The server names it "Accounts[0].AccountNumber"; fieldErrors lowercases only the first letter. */}
              {errors[`accounts[${i}].AccountNumber`] && (
                <span className="text-xs text-red-600">{errors[`accounts[${i}].AccountNumber`]}</span>
              )}
            </label>
            <label className="text-sm">
              <span className="text-stone-700">{t('responses.accountHolder')}</span>
              <input
                required
                maxLength={100}
                value={a.accountHolder}
                onChange={(e) => update(i, { accountHolder: e.target.value })}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}
              className="justify-self-start text-sm text-red-700 underline"
            >
              {t('responses.removeAccount')}
            </button>
          </fieldset>
        ))}
        {accounts.length < maxAccounts && (
          <button
            type="button"
            onClick={() => setAccounts([...accounts, emptyAccount])}
            className="text-sm text-brand-700 underline"
          >
            {t('responses.addAccount')}
          </button>
        )}
        <label className="block text-sm">
          <span className="text-stone-700">{t('responses.giftAddress')}</span>
          <textarea
            rows={3}
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </label>
      </fieldset>
      {save.isError && <p className="text-sm text-red-700">{errorMessage(t, save.error)}</p>}
      {save.isSuccess && <p className="text-sm text-emerald-700">{t('common.saved')}</p>}
      {!readOnly && (
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t('common.save')}
        </button>
      )}
    </form>
  )
}

/** Owner/Admin: amplop digital accounts and address (Q-41), and the guests' gift confirmations. */
export function GiftsPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const gifts = useEventGifts(id)
  const confirmations = useGiftConfirmations(id)

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-8">
      <Link to={`/app/events/${id}`} className="text-sm text-brand-700 underline">
        ← {event.data?.name ?? t('events.title')}
      </Link>
      <h1 className="text-2xl font-semibold text-brand-900">{t('responses.giftsTitle')}</h1>
      <p className="text-sm text-stone-600">{t('responses.giftsHint')}</p>
      {gifts.isError && <p className="text-red-700">{errorMessage(t, gifts.error)}</p>}
      {gifts.data && event.data && (
        <GiftsForm eventId={id} initial={gifts.data} readOnly={!isEditable(event.data.status)} />
      )}

      <h2 className="pt-4 font-semibold text-brand-900">{t('responses.confirmationsTitle')}</h2>
      {confirmations.data?.length === 0 && (
        <p className="text-sm text-stone-500">{t('responses.noConfirmations')}</p>
      )}
      <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4 empty:hidden">
        {confirmations.data?.map((c) => (
          <li key={c.id} className="py-3 text-sm">
            <p className="font-medium text-stone-800">
              {c.senderName} <span className="font-normal text-stone-500">({c.guestName})</span>
            </p>
            <p className="text-stone-600">
              {c.amount != null ? formatMoney(c.amount, 'IDR', i18n.language) : t('responses.noAmount')}
              {c.note && ` · ${c.note}`} · {new Date(c.createdAt).toLocaleString(i18n.language)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
