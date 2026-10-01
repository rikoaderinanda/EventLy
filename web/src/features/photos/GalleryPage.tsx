import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useEvent } from '@/features/events/api'
import { errorMessage } from '@/shared/lib/errors'
import { downloadZip, useDeletePhoto, useGallery, useGuestCameraSwitch, type Photo } from './api'

function megabytes(bytes: number, locale: string) {
  return (bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })
}

/** Owner/Admin: every photo of the event, grouped by guest, with delete and (if the package allows) ZIP download. */
export function GalleryPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const gallery = useGallery(id)
  const remove = useDeletePhoto(id)
  const camera = useGuestCameraSwitch(id)
  const [zipError, setZipError] = useState<unknown>(null)
  const [zipping, setZipping] = useState(false)
  const data = gallery.data

  const groups = new Map<string, Photo[]>()
  for (const photo of data?.photos ?? []) {
    groups.set(photo.guestName, [...(groups.get(photo.guestName) ?? []), photo])
  }

  async function zip() {
    setZipError(null)
    setZipping(true)
    try {
      await downloadZip(id, `${event.data?.name ?? 'galeri'}.zip`)
    } catch (e) {
      setZipError(e)
    } finally {
      setZipping(false)
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 py-8">
      <Link to={`/app/events/${id}`} className="text-sm text-brand-700 underline">
        ← {event.data?.name ?? t('events.title')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-brand-900">{t('photos.galleryTitle')}</h1>
        {data?.zipAllowed && data.total > 0 && (
          <button
            type="button"
            disabled={zipping}
            onClick={() => void zip()}
            className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {zipping ? t('common.loading') : t('photos.downloadAll')}
          </button>
        )}
      </div>
      {data && (
        <p className="text-sm text-stone-600">
          {data.limit != null
            ? t('photos.countWithLimit', {
                total: data.total,
                limit: data.limit,
                mb: megabytes(data.storageBytes, i18n.language),
              })
            : t('photos.count', { total: data.total, mb: megabytes(data.storageBytes, i18n.language) })}
        </p>
      )}
      {data && !data.guestCameraInPackage && (
        <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-600">
          {t('photos.guestCameraNotInPackage')}
        </p>
      )}
      {data?.guestCameraInPackage && (
        <label className="flex items-center gap-2 rounded-lg border border-brand-100 bg-white p-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={data.guestCameraEnabled}
            disabled={camera.isPending}
            onChange={(e) => camera.mutate(e.target.checked)}
          />
          {t('photos.guestCameraSwitch')}
        </label>
      )}
      {(gallery.isError || remove.isError || zipError !== null) && (
        <p role="alert" className="text-red-700">
          {errorMessage(t, gallery.error ?? remove.error ?? zipError)}
        </p>
      )}
      {data?.total === 0 && <p className="text-stone-500">{t('photos.empty')}</p>}

      {[...groups].map(([guestName, photos]) => (
        <div key={guestName} className="space-y-2">
          <h2 className="font-semibold text-brand-900">
            {guestName} <span className="text-sm font-normal text-stone-500">({photos.length})</span>
          </h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((photo) => (
              <li key={photo.id} className="group relative">
                <a href={photo.url} target="_blank" rel="noreferrer noopener">
                  <img
                    src={photo.thumbnailUrl}
                    alt={t('photos.photoOf', { name: guestName })}
                    loading="lazy"
                    className="aspect-square w-full rounded-md object-cover"
                  />
                </a>
                {photo.source === 'Guest' && (
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-xs text-white">
                    {t('photos.byGuest')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => window.confirm(t('photos.confirmDelete')) && remove.mutate(photo.id)}
                  className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs text-red-700"
                >
                  {t('photos.delete')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
