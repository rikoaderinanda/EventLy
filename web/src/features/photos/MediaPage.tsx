import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { isEditable, useEvent } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import { useEventMedia, useSetMedia, type MediaKind } from './api'

function MediaItem({
  eventId,
  kind,
  url,
  readOnly,
}: {
  eventId: string
  kind: MediaKind
  url: string | null
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const save = useSetMedia(eventId)
  const accept = kind === 'music' ? '.mp3,.m4a,audio/mpeg,audio/mp4' : 'image/jpeg,image/png,image/webp'

  return (
    <section className="space-y-3 rounded-lg border border-brand-100 bg-white p-4">
      <h2 className="font-semibold text-brand-900">{t(`media.${kind}.title`)}</h2>
      <p className="text-sm text-stone-600">{t(`media.${kind}.hint`)}</p>
      {url && kind === 'music' && <audio controls src={url} className="w-full" />}
      {url && kind !== 'music' && (
        <img
          src={url}
          alt={t(`media.${kind}.title`)}
          className="max-h-60 rounded-md border border-stone-200"
        />
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="cursor-pointer rounded-md border border-brand-700 px-3 py-1.5 font-medium text-brand-700">
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
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate({ kind, file: null })}
              className="text-red-700 underline"
            >
              {t('media.remove')}
            </button>
          )}
          {save.isPending && <span className="text-stone-500">{t('common.loading')}</span>}
        </div>
      )}
      {save.isError && <p className="text-sm text-red-700">{errorMessage(t, save.error)}</p>}
    </section>
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
    <section className="mx-auto max-w-2xl space-y-4 py-8">
      <Link to={`/app/events/${id}`} className="text-sm text-brand-700 underline">
        ← {event.data?.name ?? t('events.title')}
      </Link>
      <h1 className="text-2xl font-semibold text-brand-900">{t('media.title')}</h1>
      {media.isError && <p className="text-red-700">{errorMessage(t, media.error)}</p>}
      {media.data && (
        <>
          <MediaItem eventId={id} kind="cover" url={media.data.coverUrl} readOnly={readOnly} />
          <MediaItem eventId={id} kind="music" url={media.data.musicUrl} readOnly={readOnly} />
          <MediaItem eventId={id} kind="qris" url={media.data.qrisUrl} readOnly={readOnly} />
        </>
      )}
    </section>
  )
}
