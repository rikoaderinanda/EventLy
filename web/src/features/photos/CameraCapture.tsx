import { Check, RotateCcw, SwitchCamera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@/shared/lib/errors'
import { compressPhoto } from '@/shared/lib/image'
import { Spinner } from '@/components/ui/Spinner'

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

  // Escape closes the camera only, not a sheet it was opened from (capture phase, before the sheet hears it).
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('photos.camera')}
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white"
    >
      <div className="relative flex-1">
        {cameraError ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-white/85">
            {t('checkin.cameraDenied')}
          </p>
        ) : shot ? (
          <img src={shot.url} alt={t('photos.preview')} className="h-full w-full object-contain" />
        ) : (
          <video ref={video} muted playsInline className="h-full w-full object-cover" />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('ui.close')}
          className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {error !== null && <p className="bg-danger-700 p-2 text-center text-sm">{errorMessage(t, error)}</p>}
      <div className="flex items-center justify-around gap-2 px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {shot ? (
          <>
            <button
              type="button"
              onClick={retake}
              disabled={sending}
              className="flex h-12 items-center gap-2 rounded-full px-5 font-medium text-white/90 hover:bg-white/10"
            >
              <RotateCcw aria-hidden className="size-5" />
              {t('photos.retake')}
            </button>
            <button
              type="button"
              onClick={() => void use()}
              disabled={sending}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-stone-950 disabled:opacity-60"
            >
              {sending ? <Spinner /> : <Check aria-hidden className="size-5" />}
              {sending ? t('photos.uploading') : t('photos.use')}
            </button>
          </>
        ) : (
          <>
            <span className="w-24" />
            <button
              type="button"
              onClick={() => void capture()}
              disabled={cameraError}
              aria-label={t('photos.shutter')}
              className="flex size-[4.5rem] items-center justify-center rounded-full border-4 border-white transition-transform active:scale-90 disabled:opacity-40"
            >
              <span className="size-14 rounded-full bg-white" />
            </button>
            <button
              type="button"
              onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')}
              aria-label={t('photos.switchCamera')}
              title={t('photos.switchCamera')}
              className="flex size-12 w-24 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
            >
              <SwitchCamera aria-hidden className="size-6" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
