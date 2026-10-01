import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@/shared/lib/errors'
import { compressPhoto } from '@/shared/lib/image'
import { uploadPhotos } from './api'
import { CameraCapture } from './CameraCapture'

/**
 * "Ambil foto" after a check-in (optional step, decided 2026-09-29): the in-app camera on a phone or a
 * laptop webcam, one photo after another. "Pilih file" stays as a fallback (a device without a camera,
 * photos taken with the phone's own camera app).
 */
export function StaffPhotoButton({ invitationId }: { invitationId: string }) {
  const { t } = useTranslation()
  const [uploaded, setUploaded] = useState(0)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function send(photos: Blob[]) {
    const saved = await uploadPhotos(invitationId, photos)
    setUploaded((n) => n + saved.length)
  }

  async function sendFiles(files: FileList) {
    setBusy(true)
    setError(null)
    try {
      await send(await Promise.all([...files].slice(0, 10).map((file) => compressPhoto(file))))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => setCameraOpen(true)}
        className="w-full rounded-xl border-2 border-brand-700 py-3 font-semibold text-brand-700 disabled:opacity-50"
      >
        {uploaded > 0 ? t('photos.takeAnother') : t('photos.take')}
      </button>
      <label className="block cursor-pointer text-center text-sm text-stone-600 underline">
        {busy ? t('photos.uploading') : t('photos.pickFiles')}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          className="sr-only"
          aria-label={t('photos.pickFiles')}
          onChange={(e) => {
            if (e.target.files?.length) void sendFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      {uploaded > 0 && (
        <p role="status" className="text-sm text-emerald-700">
          {t('photos.uploaded', { n: uploaded })}
        </p>
      )}
      {error !== null && <p className="text-sm text-red-700">{errorMessage(t, error)}</p>}
      {cameraOpen && <CameraCapture onUse={(photo) => send([photo])} onClose={() => setCameraOpen(false)} />}
    </div>
  )
}
