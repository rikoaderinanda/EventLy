import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '@/api/client'
import { env } from '@/config/env'
import { errorMessage } from '@/shared/lib/errors'
import { CameraCapture } from '@/features/photos/CameraCapture'

type PublicPhoto = { id: string; thumbnailUrl: string; url: string; isMine: boolean; createdAt: string }
type PublicGallery = {
  photos: PublicPhoto[]
  camera: { available: boolean; taken: number; limit: number; closesAt: string | null }
}

const base = (code: string) => `/public/invitations/${encodeURIComponent(code)}`

/**
 * The guest's own gallery, open after check-in: photos of this invitation (by Staff and by the guest), with
 * download, and the in-app camera while it is available (Q-25/Q-26). The guest deletes only their own shots.
 */
export function GuestGallery({ code }: { code: string }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [cameraOpen, setCameraOpen] = useState(false)
  const key = ['public', code, 'gallery'] as const
  const gallery = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<PublicGallery>(`${base(code)}/gallery`, { skipAuthRefresh: true }),
  })
  const remove = useMutation({
    mutationFn: (photoId: string) =>
      apiFetch<void>(`${base(code)}/photos/${photoId}`, { method: 'DELETE', skipAuthRefresh: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  async function upload(photo: Blob) {
    const form = new FormData()
    form.append('file', photo, 'foto.jpg')
    await apiFetch(`${base(code)}/photos`, { method: 'POST', body: form, skipAuthRefresh: true })
    await queryClient.invalidateQueries({ queryKey: key })
  }

  if (gallery.isPending) return <p className="text-center text-sm text-stone-500">{t('common.loading')}</p>
  if (gallery.isError)
    return <p className="text-center text-sm text-red-700">{errorMessage(t, gallery.error)}</p>
  const { photos, camera } = gallery.data

  return (
    <div className="space-y-4">
      {camera.available && (
        <div className="space-y-1 text-center">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="rounded-full bg-brand-700 px-6 py-3 font-semibold text-white"
          >
            {t('photos.take')}
          </button>
          <p className="text-xs text-stone-500">
            {t('photos.cameraLeft', { n: camera.limit - camera.taken, limit: camera.limit })}
            {camera.closesAt &&
              ` · ${t('photos.cameraUntil', { time: new Date(camera.closesAt).toLocaleString(i18n.language) })}`}
          </p>
        </div>
      )}
      {photos.length === 0 && <p className="text-center text-sm text-stone-600">{t('photos.guestEmpty')}</p>}
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <li key={photo.id} className="space-y-1">
            <a href={photo.url} target="_blank" rel="noreferrer noopener">
              <img
                src={photo.thumbnailUrl}
                alt={t('photos.yourPhoto')}
                loading="lazy"
                className="aspect-square w-full rounded-md object-cover"
              />
            </a>
            <div className="flex justify-between text-xs">
              <a
                href={`${env.apiBaseUrl}${base(code)}/gallery/${photo.id}/download`}
                className="text-brand-700 underline"
              >
                {t('photos.download')}
              </a>
              {photo.isMine && (
                <button
                  type="button"
                  onClick={() => window.confirm(t('photos.confirmDelete')) && remove.mutate(photo.id)}
                  className="text-red-700 underline"
                >
                  {t('photos.delete')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {remove.isError && <p className="text-sm text-red-700">{errorMessage(t, remove.error)}</p>}
      {cameraOpen && <CameraCapture onUse={upload} onClose={() => setCameraOpen(false)} />}
    </div>
  )
}
