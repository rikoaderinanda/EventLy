import { Ban, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Feedback'
import { Skeleton } from '@/components/ui/Spinner'
import { errorMessage } from '@/shared/lib/errors'
import { useOwners, useSuspendOwner } from './api'

/** Root: Owner accounts, their organization and what they bought. Dense and neutral (enterprise minimal). */
export function OwnersPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const owners = useOwners(search)
  const toggle = useSuspendOwner()

  return (
    <section className="mx-auto max-w-5xl space-y-5 py-6 sm:py-10">
      <PageHeader
        title={t('platform.ownersTitle')}
        subtitle={t('platform.ownersSubtitle')}
        className="mb-0 sm:mb-0"
      />
      <label className="relative block max-w-md">
        <span className="sr-only">{t('platform.search')}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400"
        />
        <input
          type="search"
          placeholder={t('platform.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-10 text-sm hover:border-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
        />
      </label>
      {owners.isError && <Notice tone="danger">{errorMessage(t, owners.error)}</Notice>}
      {toggle.isError && <Notice tone="danger">{errorMessage(t, toggle.error)}</Notice>}
      {owners.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {owners.data?.length === 0 && <EmptyState kind="guests" title={t('platform.empty')} />}
      {owners.data && owners.data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_8rem] gap-4 border-b border-stone-200 bg-stone-50 px-5 py-2.5 text-xs font-medium tracking-wide text-stone-500 uppercase md:grid"
          >
            <span>{t('platform.column.owner')}</span>
            <span>{t('platform.column.organization')}</span>
            <span>{t('platform.column.status')}</span>
            <span />
          </div>
          <ul className="divide-y divide-stone-200">
            {owners.data.map((owner) => {
              const suspended = owner.status === 'Disabled'
              return (
                <li
                  key={owner.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-5 py-3.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_8rem] md:gap-4"
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                    <Avatar name={owner.name} size="sm" />
                    <div className="min-w-0">
                      <Link
                        to={`/platform/owners/${owner.id}`}
                        className="block truncate font-medium text-stone-900 hover:text-brand-700 hover:underline"
                      >
                        {owner.name}
                      </Link>
                      <p className="truncate text-xs text-stone-500">{owner.email}</p>
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 text-sm md:col-span-1">
                    <p className="truncate text-stone-700">
                      {owner.organization?.name ?? t('platform.noOrganization')}
                    </p>
                    <p className="text-xs text-stone-500">{t('platform.purchases', owner.purchases)}</p>
                  </div>
                  <div>
                    <Badge tone={suspended ? 'danger' : 'success'}>
                      {suspended ? t('platform.suspended') : t('platform.active')}
                    </Badge>
                  </div>
                  <div className="justify-self-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={suspended ? RotateCcw : Ban}
                      disabled={toggle.isPending}
                      className={
                        suspended ? undefined : 'text-danger-700 hover:bg-danger-50 hover:text-danger-700'
                      }
                      onClick={() => {
                        if (!suspended && !window.confirm(t('platform.confirmSuspend', { name: owner.name })))
                          return
                        toggle.mutate({ id: owner.id, suspend: !suspended })
                      }}
                    >
                      {suspended ? t('platform.reactivate') : t('platform.suspend')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
