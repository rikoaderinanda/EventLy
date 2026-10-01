import { CameraOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorConstructor = new (options: { formats: string[] }) => Detector

/** The browser's own QR reader (Chrome on Android); jsQR is loaded only where it is missing (iOS Safari). */
function nativeDetector(): Detector | null {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
  return Ctor ? new Ctor({ formats: ['qr_code'] }) : null
}

/** Four white corner brackets around the scan area, and a soft moving line while scanning. */
function Frame({ active }: { active: boolean }) {
  const corner = 'absolute size-12 border-white'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[12%]">
      <span className={`${corner} top-0 left-0 rounded-tl-2xl border-t-4 border-l-4`} />
      <span className={`${corner} top-0 right-0 rounded-tr-2xl border-t-4 border-r-4`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
      <span className={`${corner} right-0 bottom-0 rounded-br-2xl border-r-4 border-b-4`} />
      {active && (
        <span className="absolute inset-x-4 top-0 h-0.5 animate-[scanline_2.4s_ease-in-out_infinite] rounded-full bg-gold-300 shadow-[0_0_12px_2px_rgb(226_199_102/0.7)] motion-reduce:hidden" />
      )}
    </div>
  )
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
      <div
        role="alert"
        className="flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-center"
      >
        <CameraOff aria-hidden className="size-10 text-white/60" />
        <p className="text-sm text-white/85">
          {t(error === 'denied' ? 'checkin.cameraDenied' : 'checkin.cameraUnavailable')}
        </p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-black shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
      <video
        ref={video}
        muted
        playsInline
        aria-label={t('checkin.camera')}
        className="aspect-square w-full object-cover"
      />
      <Frame active={!paused} />
      <p className="absolute inset-x-0 bottom-4 text-center text-sm font-medium text-white/90 drop-shadow">
        {t('checkin.aim')}
      </p>
    </div>
  )
}
