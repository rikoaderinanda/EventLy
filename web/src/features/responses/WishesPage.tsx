import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useEvent } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import { useModerateWish, useWishes } from './api'

/** Owner/Admin: every wish, with hide/show and delete (Q-42: no approval step, moderation afterwards). */
export function WishesPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const wishes = useWishes(id)
  const moderate = useModerateWish(id)

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-8">
      <Link to={`/app/events/${id}`} className="text-sm text-brand-700 underline">
        ← {event.data?.name ?? t('events.title')}
      </Link>
      <h1 className="text-2xl font-semibold text-brand-900">{t('responses.wishesTitle')}</h1>
      <p className="text-sm text-stone-600">{t('responses.wishesHint')}</p>
      {(wishes.isError || moderate.isError) && (
        <p className="text-red-700">{errorMessage(t, wishes.error ?? moderate.error)}</p>
      )}
      {wishes.data?.length === 0 && <p className="text-stone-500">{t('responses.noWishes')}</p>}
      <ul className="space-y-3">
        {wishes.data?.map((w) => (
          <li
            key={w.id}
            className={`rounded-lg border bg-white p-4 ${w.isHidden ? 'border-dashed border-stone-300 opacity-70' : 'border-brand-100'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-brand-900">
                {w.guestName}
                {w.isHidden && <span className="ml-2 text-xs text-stone-500">({t('responses.hidden')})</span>}
              </p>
              <p className="text-xs text-stone-500">{new Date(w.updatedAt).toLocaleString(i18n.language)}</p>
            </div>
            <p className="mt-1 text-sm whitespace-pre-line text-stone-700">{w.message}</p>
            <div className="mt-2 flex gap-3 text-sm">
              <button
                type="button"
                disabled={moderate.isPending}
                onClick={() => moderate.mutate({ id: w.id, action: w.isHidden ? 'unhide' : 'hide' })}
                className="text-brand-700 underline"
              >
                {w.isHidden ? t('responses.show') : t('responses.hide')}
              </button>
              <button
                type="button"
                disabled={moderate.isPending}
                onClick={() =>
                  window.confirm(t('responses.confirmDeleteWish')) &&
                  moderate.mutate({ id: w.id, action: 'delete' })
                }
                className="text-red-700 underline"
              >
                {t('responses.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
