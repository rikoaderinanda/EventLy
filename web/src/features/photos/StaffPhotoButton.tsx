import { Camera, ImagePlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { Spinner } from '@/components/ui/Spinner'
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
    <div className="space-y-2 rounded-2xl bg-brand-50 p-3">
      <Button
        variant="secondary"
        size="lg"
        block
        icon={Camera}
        disabled={busy}
        onClick={() => setCameraOpen(true)}
      >
        {uploaded > 0 ? t('photos.takeAnother') : t('photos.take')}
      </Button>
      <label className="flex cursor-pointer items-center justify-center gap-1.5 py-1 text-sm text-stone-600 hover:text-brand-800 has-focus-visible:outline-2 has-focus-visible:outline-brand-600">
        {busy ? <Spinner /> : <ImagePlus aria-hidden className="size-4" />}
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
      {uploaded > 0 && <Notice tone="success">{t('photos.uploaded', { n: uploaded })}</Notice>}
      {error !== null && <Notice tone="danger">{errorMessage(t, error)}</Notice>}
      {cameraOpen && <CameraCapture onUse={(photo) => send([photo])} onClose={() => setCameraOpen(false)} />}
    </div>
  )
}
