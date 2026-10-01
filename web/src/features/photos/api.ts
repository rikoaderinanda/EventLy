import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchBlob } from '@/api/client'
import { saveBlob } from '@/shared/lib/image'

export type PhotoSource = 'Staff' | 'Owner' | 'Guest'

export type Photo = {
  id: string
  invitationId: string
  guestName: string
  source: PhotoSource
  thumbnailUrl: string
  url: string
  width: number
  height: number
  createdAt: string
}

export type Gallery = {
  photos: Photo[]
  total: number
  limit: number | null
  storageBytes: number
  zipAllowed: boolean
  guestCameraInPackage: boolean
  guestCameraEnabled: boolean
}

export type EventMedia = { coverUrl: string | null; qrisUrl: string | null; musicUrl: string | null }
export type MediaKind = 'cover' | 'qris' | 'music'

export const photoKeys = {
  gallery: (eventId: string) => ['events', eventId, 'gallery'] as const,
  media: (eventId: string) => ['events', eventId, 'media'] as const,
}

function form(field: string, files: Blob[]) {
  const data = new FormData()
  files.forEach((file, i) => data.append(field, file, `foto-${i + 1}.jpg`))
  return data
}

/** Staff/Owner: photos for a checked-in invitation (already compressed by the caller). */
export function uploadPhotos(invitationId: string, photos: Blob[]) {
  return apiFetch<Photo[]>(`/invitations/${invitationId}/photos`, {
    method: 'POST',
    body: form('files', photos),
  })
}

export function useGallery(eventId: string) {
  return useQuery({
    queryKey: photoKeys.gallery(eventId),
    queryFn: () => apiFetch<Gallery>(`/events/${eventId}/gallery`),
  })
}

export function useDeletePhoto(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (photoId: string) => apiFetch<void>(`/photos/${photoId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.gallery(eventId) }),
  })
}

export function useGuestCameraSwitch(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<void>(`/events/${eventId}/guest-camera`, { method: 'PUT', body: { enabled } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.gallery(eventId) }),
  })
}

/** The ZIP needs the access token, so it is fetched and then saved. */
export async function downloadZip(eventId: string, fileName: string) {
  saveBlob(await apiFetchBlob(`/events/${eventId}/gallery/zip`), fileName)
}

export function useEventMedia(eventId: string) {
  return useQuery({
    queryKey: photoKeys.media(eventId),
    queryFn: () => apiFetch<EventMedia>(`/events/${eventId}/media`),
  })
}

export function useSetMedia(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, file }: { kind: MediaKind; file: Blob | null }) =>
      file
        ? apiFetch<EventMedia>(`/events/${eventId}/media/${kind}`, {
            method: 'PUT',
            body: form('file', [file]),
          })
        : apiFetch<EventMedia>(`/events/${eventId}/media/${kind}`, { method: 'DELETE' }),
    onSuccess: (media) => queryClient.setQueryData(photoKeys.media(eventId), media),
  })
}
