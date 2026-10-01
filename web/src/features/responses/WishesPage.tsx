import { Eye, EyeOff, Quote, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Feedback'
import { Skeleton } from '@/components/ui/Spinner'
import { EventPageHeader } from '@/features/events/EventPageHeader'
import { errorMessage } from '@/shared/lib/errors'
import { useModerateWish, useWishes } from './api'

/** Owner/Admin: every wish, with hide/show and delete (Q-42: no approval step, moderation afterwards). */
export function WishesPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const wishes = useWishes(id)
  const moderate = useModerateWish(id)

  return (
    <section className="mx-auto max-w-5xl space-y-5 py-6 sm:py-10">
      <EventPageHeader eventId={id} title={t('responses.wishesTitle')} subtitle={t('responses.wishesHint')} />
      {(wishes.isError || moderate.isError) && (
        <Notice tone="danger">{errorMessage(t, wishes.error ?? moderate.error)}</Notice>
      )}
      {wishes.isPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      )}
      {wishes.data?.length === 0 && (
        <Card>
          <EmptyState kind="wishes" title={t('responses.noWishes')} />
        </Card>
      )}
      <ul className="columns-1 gap-4 sm:columns-2 [&>li]:mb-4 [&>li]:break-inside-avoid">
        {wishes.data?.map((w) => (
          <li
            key={w.id}
            className={cn(
              'relative rounded-2xl border bg-white p-5 shadow-soft',
              w.isHidden ? 'border-dashed border-stone-300 bg-stone-50 shadow-none' : 'border-brand-100',
            )}
          >
            <Quote aria-hidden className="absolute top-4 right-4 size-6 text-brand-200" />
            <div className="flex items-center gap-3">
              <Avatar name={w.guestName} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-950">{w.guestName}</p>
                <p className="text-xs text-stone-500">
                  {new Date(w.updatedAt).toLocaleString(i18n.language)}
                </p>
              </div>
            </div>
            <p
              className={cn(
                'mt-3 text-body whitespace-pre-line',
                w.isHidden ? 'text-stone-500' : 'text-stone-700',
              )}
            >
              {w.message}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {w.isHidden && (
                <Badge tone="neutral" icon={EyeOff}>
                  {t('responses.hidden')}
                </Badge>
              )}
              <span className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                icon={w.isHidden ? Eye : EyeOff}
                disabled={moderate.isPending}
                onClick={() => moderate.mutate({ id: w.id, action: w.isHidden ? 'unhide' : 'hide' })}
              >
                {w.isHidden ? t('responses.show') : t('responses.hide')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                disabled={moderate.isPending}
                className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
                onClick={() =>
                  window.confirm(t('responses.confirmDeleteWish')) &&
                  moderate.mutate({ id: w.id, action: 'delete' })
                }
              >
                {t('responses.delete')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
