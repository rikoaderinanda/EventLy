import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { errorMessage } from '@/shared/lib/errors'
import { useOwners, useSuspendOwner } from './api'

/** Root: Owner accounts, their organization and what they bought. */
export function OwnersPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const owners = useOwners(search)
  const toggle = useSuspendOwner()

  return (
    <section className="mx-auto max-w-4xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold text-brand-900">{t('platform.ownersTitle')}</h1>
      <input
        type="search"
        placeholder={t('platform.search')}
        aria-label={t('platform.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2"
      />
      {owners.isError && <p className="text-red-700">{errorMessage(t, owners.error)}</p>}
      {toggle.isError && <p className="text-red-700">{errorMessage(t, toggle.error)}</p>}
      <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4">
        {owners.data?.map((owner) => {
          const suspended = owner.status === 'Disabled'
          return (
            <li key={owner.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/platform/owners/${owner.id}`}
                  className="block truncate font-medium text-brand-800 underline"
                >
                  {owner.name}
                </Link>
                <p className="truncate text-sm text-stone-500">{owner.email}</p>
              </div>
              <div className="text-sm text-stone-600">
                <p>{owner.organization?.name ?? t('platform.noOrganization')}</p>
                <p className="text-xs text-stone-500">{t('platform.purchases', owner.purchases)}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${suspended ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
              >
                {suspended ? t('platform.suspended') : t('platform.active')}
              </span>
              <button
                type="button"
                disabled={toggle.isPending}
                onClick={() => {
                  if (!suspended && !window.confirm(t('platform.confirmSuspend', { name: owner.name })))
                    return
                  toggle.mutate({ id: owner.id, suspend: !suspended })
                }}
                className="text-sm text-stone-700 underline"
              >
                {suspended ? t('platform.reactivate') : t('platform.suspend')}
              </button>
            </li>
          )
        })}
        {owners.data?.length === 0 && (
          <li className="py-6 text-center text-stone-500">{t('platform.empty')}</li>
        )}
      </ul>
    </section>
  )
}
