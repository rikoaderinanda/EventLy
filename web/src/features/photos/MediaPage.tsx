import { ImageIcon, Music, QrCode, RefreshCw, Trash2, Upload, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { Card } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Feedback'
import { Skeleton, Spinner } from '@/components/ui/Spinner'
import { isEditable, useEvent } from '@/features/events/api'
import { EventPageHeader } from '@/features/events/EventPageHeader'
import { errorMessage } from '@/shared/lib/errors'
import { useEventMedia, useSetMedia, type MediaKind } from './api'

const icons: Record<MediaKind, LucideIcon> = { cover: ImageIcon, music: Music, qris: QrCode }

function MediaItem({
  eventId,
  kind,
  url,
  readOnly,
  className,
}: {
  eventId: string
  kind: MediaKind
  url: string | null
  readOnly: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const save = useSetMedia(eventId)
  const accept = kind === 'music' ? '.mp3,.m4a,audio/mpeg,audio/mp4' : 'image/jpeg,image/png,image/webp'
  const Icon = icons[kind]

  return (
    <Card as="section" className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-card">{t(`media.${kind}.title`)}</h2>
          <p className="mt-0.5 text-sm text-stone-500">{t(`media.${kind}.hint`)}</p>
        </div>
      </div>

      {url && kind === 'music' && <audio controls src={url} className="w-full" />}
      {url && kind !== 'music' && (
        <img
          src={url}
          alt={t(`media.${kind}.title`)}
          className={cn(
            'w-full rounded-xl border border-brand-100 bg-brand-50',
            kind === 'cover' ? 'aspect-[16/9] object-cover' : 'mx-auto max-h-64 object-contain',
          )}
        />
      )}
      {!url && (
        <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 py-10">
          <Icon aria-hidden className="size-8 text-brand-300" strokeWidth={1.5} />
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={buttonClass(
              { variant: url ? 'secondary' : 'primary', size: 'sm' },
              cn(
                'cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-brand-600',
                save.isPending && 'opacity-50',
              ),
            )}
          >
            {save.isPending ? <Spinner /> : url ? <RefreshCw aria-hidden /> : <Upload aria-hidden />}
            {url ? t('media.replace') : t('media.upload')}
            <input
              type="file"
              accept={accept}
              className="sr-only"
              aria-label={t(`media.${kind}.title`)}
              disabled={save.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) save.mutate({ kind, file })
                e.target.value = ''
              }}
            />
          </label>
          {url && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              disabled={save.isPending}
              className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
              onClick={() => save.mutate({ kind, file: null })}
            >
              {t('media.remove')}
            </Button>
          )}
        </div>
      )}
      {save.isError && <Notice tone="danger">{errorMessage(t, save.error)}</Notice>}
    </Card>
  )
}

/** Owner/Admin: the invitation page's cover photo, background music (Q-43) and QRIS image (Q-41). */
export function MediaPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const media = useEventMedia(id)
  const readOnly = event.data ? !isEditable(event.data.status) : true

  return (
    <section className="mx-auto max-w-5xl space-y-5 py-6 sm:py-10">
      <EventPageHeader eventId={id} title={t('media.title')} subtitle={t('media.entry')} />
      {media.isError && <Notice tone="danger">{errorMessage(t, media.error)}</Notice>}
      {media.isPending && <Skeleton className="h-72 rounded-2xl" />}
      {media.data && (
        <div className="grid gap-4 md:grid-cols-2">
          <MediaItem
            eventId={id}
            kind="cover"
            url={media.data.coverUrl}
            readOnly={readOnly}
            className="md:col-span-2"
          />
          <MediaItem eventId={id} kind="music" url={media.data.musicUrl} readOnly={readOnly} />
          <MediaItem eventId={id} kind="qris" url={media.data.qrisUrl} readOnly={readOnly} />
        </div>
      )}
    </section>
  )
}
