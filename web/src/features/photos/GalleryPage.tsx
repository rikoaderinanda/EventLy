import { Archive, Camera, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice, ProgressBar } from '@/components/ui/Feedback'
import { Switch } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Spinner'
import { useEvent } from '@/features/events/api'
import { EventPageHeader } from '@/features/events/EventPageHeader'
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
    <section className="mx-auto max-w-6xl space-y-5 py-6 sm:py-10">
      <EventPageHeader
        eventId={id}
        title={t('photos.galleryTitle')}
        subtitle={
          data &&
          (data.limit != null
            ? t('photos.countWithLimit', {
                total: data.total,
                limit: data.limit,
                mb: megabytes(data.storageBytes, i18n.language),
              })
            : t('photos.count', { total: data.total, mb: megabytes(data.storageBytes, i18n.language) }))
        }
        actions={
          data?.zipAllowed &&
          data.total > 0 && (
            <Button icon={Archive} loading={zipping} onClick={() => void zip()} block="mobile">
              {t('photos.downloadAll')}
            </Button>
          )
        }
      />

      {data?.limit != null && (
        <ProgressBar value={data.total} max={data.limit} label={t('stats.photos')} className="max-w-md" />
      )}
      {data && !data.guestCameraInPackage && <Notice>{t('photos.guestCameraNotInPackage')}</Notice>}
      {data?.guestCameraInPackage && (
        <Card padding="sm">
          <Switch
            label={t('photos.guestCameraSwitch')}
            description={t('photos.guestCameraHint')}
            checked={data.guestCameraEnabled}
            disabled={camera.isPending}
            onChange={(e) => camera.mutate(e.target.checked)}
          />
        </Card>
      )}
      {(gallery.isError || remove.isError || zipError !== null) && (
        <Notice tone="danger">{errorMessage(t, gallery.error ?? remove.error ?? zipError)}</Notice>
      )}
      {gallery.isPending && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      )}
      {data?.total === 0 && (
        <Card>
          <EmptyState kind="photos" title={t('photos.empty')} />
        </Card>
      )}

      {[...groups].map(([guestName, photos]) => (
        <div key={guestName} className="space-y-3">
          <h2 className="flex items-center gap-2.5 text-card">
            <Avatar name={guestName} size="sm" />
            {guestName} <span className="text-sm font-normal text-stone-500">({photos.length})</span>
          </h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((photo) => (
              <li key={photo.id} className="group relative overflow-hidden rounded-xl">
                <a href={photo.url} target="_blank" rel="noreferrer noopener">
                  <img
                    src={photo.thumbnailUrl}
                    alt={t('photos.photoOf', { name: guestName })}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </a>
                {photo.source === 'Guest' && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] text-white backdrop-blur">
                    <Camera aria-hidden className="size-3" />
                    {t('photos.byGuest')}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={t('photos.delete')}
                  title={t('photos.delete')}
                  onClick={() => window.confirm(t('photos.confirmDelete')) && remove.mutate(photo.id)}
                  className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full bg-white/90 text-danger-700 shadow-soft transition-opacity hover:bg-white sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 pointer-coarse:opacity-100"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
