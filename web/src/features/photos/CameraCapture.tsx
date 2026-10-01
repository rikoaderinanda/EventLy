import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@/shared/lib/errors'
import { compressPhoto } from '@/shared/lib/image'

/**
 * In-app camera: a live view, a shutter, then "Pakai" or "Ulangi". Used by the guest (Q-25: no file picker,
 * so only photos taken at the event are sent; the server limits the rest) and by Staff after a check-in.
 * Works with a phone camera and a laptop webcam; the browser needs HTTPS or localhost for the camera.
 */
export function CameraCapture({
  onUse,
  onClose,
}: {
  onUse: (photo: Blob) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
        if (stopped || !video.current) return
        video.current.srcObject = stream
        await video.current.play().catch(() => undefined)
      } catch {
        setCameraError(true)
      }
    })()
    return () => {
      stopped = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [facing])

  async function capture() {
    if (!video.current) return
    const blob = await compressPhoto(video.current)
    setShot({ blob, url: URL.createObjectURL(blob) })
  }

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(null)
  }

  async function use() {
    if (!shot) return
    setSending(true)
    setError(null)
    try {
      await onUse(shot.blob)
      retake()
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('photos.camera')}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="relative flex-1">
        {cameraError ? (
          <p className="p-6 text-center text-white">{t('checkin.cameraDenied')}</p>
        ) : shot ? (
          <img src={shot.url} alt={t('photos.preview')} className="h-full w-full object-contain" />
        ) : (
          <video ref={video} muted playsInline className="h-full w-full object-cover" />
        )}
      </div>
      {error !== null && (
        <p className="bg-red-700 p-2 text-center text-sm text-white">{errorMessage(t, error)}</p>
      )}
      <div className="flex items-center justify-around gap-2 bg-black p-4 text-white">
        {shot ? (
          <>
            <button
              type="button"
              onClick={retake}
              disabled={sending}
              className="rounded-full px-4 py-2 underline"
            >
              {t('photos.retake')}
            </button>
            <button
              type="button"
              onClick={() => void use()}
              disabled={sending}
              className="rounded-full bg-white px-6 py-2 font-semibold text-black disabled:opacity-50"
            >
              {sending ? t('photos.uploading') : t('photos.use')}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 underline">
              {t('checkin.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void capture()}
              disabled={cameraError}
              aria-label={t('photos.shutter')}
              className="size-16 rounded-full border-4 border-white bg-white/30 disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')}
              className="rounded-full px-4 py-2 underline"
            >
              {t('photos.switchCamera')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
