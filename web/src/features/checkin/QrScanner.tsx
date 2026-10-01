import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorConstructor = new (options: { formats: string[] }) => Detector

/** The browser's own QR reader (Chrome on Android); jsQR is loaded only where it is missing (iOS Safari). */
function nativeDetector(): Detector | null {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
  return Ctor ? new Ctor({ formats: ['qr_code'] }) : null
}

/**
 * Camera QR scanner. Reads a few frames per second and reports the first text found; while
 * <paramref name="paused"/> (the result sheet is open) the camera keeps running but nothing is reported.
 */
export function QrScanner({ paused, onDetect }: { paused: boolean; onDetect: (text: string) => void }) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<'denied' | 'unavailable' | null>(null)
  // The camera loop reads the latest values without restarting the camera.
  const pausedRef = useRef(paused)
  const onDetectRef = useRef(onDetect)
  useEffect(() => {
    pausedRef.current = paused
    onDetectRef.current = onDetect
  }, [paused, onDetect])

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
      } catch (e) {
        setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable')
        return
      }
      if (stopped || !video.current) return
      video.current.srcObject = stream
      await video.current.play().catch(() => undefined)

      const detector = nativeDetector()
      const jsQR = detector ? null : (await import('jsqr')).default
      const canvas = document.createElement('canvas')
      const context = detector ? null : canvas.getContext('2d', { willReadFrequently: true })

      const tick = async () => {
        const el = video.current
        if (!stopped && el && el.readyState >= 2 && !pausedRef.current) {
          let text: string | null = null
          if (detector) {
            text = (await detector.detect(el).catch(() => []))[0]?.rawValue ?? null
          } else if (jsQR && context) {
            canvas.width = el.videoWidth
            canvas.height = el.videoHeight
            context.drawImage(el, 0, 0)
            const image = context.getImageData(0, 0, canvas.width, canvas.height)
            text =
              jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null
          }
          if (text) onDetectRef.current(text)
        }
        if (!stopped) timer = window.setTimeout(() => void tick(), 250)
      }
      void tick()
    }

    void start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        {t(error === 'denied' ? 'checkin.cameraDenied' : 'checkin.cameraUnavailable')}
      </p>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        ref={video}
        muted
        playsInline
        aria-label={t('checkin.camera')}
        className="aspect-square w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-10 rounded-xl border-4 border-white/70"
      />
    </div>
  )
}
