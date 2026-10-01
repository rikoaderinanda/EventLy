import { CircleCheck, CircleX, MailOpen, ScanLine } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/components/ui/cn'

function Flourish({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 20" className={cn('mx-auto h-3 w-28 text-gold-500', className)}>
      <path d="M0 10h78M122 10h78" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M100 2l6 8-6 8-6-8z" fill="currentColor" />
    </svg>
  )
}

/** A QR-like pattern drawn in SVG (decorative: it isn't a code). */
function QrPattern() {
  const cells = ['1110111', '1000101', '1011101', '0110010', '1011011', '0001101', '1110110']
  return (
    <svg aria-hidden viewBox="0 0 70 70" className="size-24">
      {cells.flatMap((row, y) =>
        [...row].map((on, x) =>
          on === '1' ? (
            <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="9" height="9" rx="1.5" fill="#3d231b" />
          ) : null,
        ),
      )}
    </svg>
  )
}

/**
 * The hero's product picture: a phone showing the invitation, from the cover down to the QR. The screen
 * scrolls slowly on its own and the phone floats; with "reduce motion" everything stays still.
 * Swap the inner content for a real screenshot later without touching the layout.
 */
export function PhoneMockup() {
  const { t } = useTranslation()
  const still = useReducedMotion()
  const countdown = [
    { value: '80', label: t('landing.phone.days') },
    { value: '12', label: t('landing.phone.hours') },
    { value: '45', label: t('landing.phone.minutes') },
    { value: '09', label: t('landing.phone.seconds') },
  ]

  return (
    <div
      role="img"
      aria-label={t('landing.phone.label')}
      className="relative mx-auto w-full max-w-[19rem] py-6"
    >
      <div
        aria-hidden
        className="absolute inset-x-[-15%] top-[10%] bottom-[5%] -z-10 rounded-full bg-linear-to-br from-brand-200/70 via-gold-100/70 to-transparent blur-3xl"
      />

      <motion.div
        aria-hidden
        animate={still ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="relative rounded-[3rem] bg-stone-900 p-2.5 shadow-[0_40px_80px_-30px_rgb(61_35_27/0.55)] ring-1 ring-black/10"
      >
        <div className="absolute top-4 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-stone-900" />
        <div
          className="relative h-[34rem] overflow-hidden rounded-[2.4rem]"
          style={{
            background: 'radial-gradient(600px 300px at 50% -10%, #f3e3cc, transparent 60%), #faf7f2',
          }}
        >
          <motion.div
            animate={still ? undefined : { y: ['0%', '0%', '-52%', '-52%', '0%'] }}
            transition={{
              duration: 16,
              repeat: Infinity,
              ease: [0.65, 0, 0.35, 1],
              times: [0, 0.2, 0.5, 0.75, 1],
            }}
            className="space-y-4 px-5 pt-14 pb-6 text-center"
          >
            {/* Cover */}
            <div className="space-y-3 pb-2">
              <p className="text-[0.55rem] tracking-[0.3em] text-stone-500 uppercase">
                {t('landing.phone.eyebrow')}
              </p>
              <p className="font-serif text-[2.6rem] leading-none font-medium text-brand-950">
                Rina &amp; Budi
              </p>
              <p className="text-xs text-stone-600">{t('landing.phone.date')}</p>
              <p className="text-xs font-medium text-stone-600">{t('landing.phone.city')}</p>
              <Flourish />
              <p className="text-[0.65rem] text-stone-500">{t('landing.phone.dear')}</p>
              <p className="text-sm font-semibold text-brand-950">{t('landing.phone.guest')}</p>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-gradient px-4 text-xs font-semibold text-white shadow-primary">
                <MailOpen className="size-3.5" />
                {t('landing.phone.open')}
              </span>
            </div>

            {/* Countdown */}
            <div className="rounded-2xl bg-white p-3 ring-1 ring-brand-100">
              <p className="font-serif text-lg text-brand-950">{t('landing.phone.countdown')}</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {countdown.map((c) => (
                  <div key={c.label} className="rounded-lg py-1.5 ring-1 ring-brand-100">
                    <p className="text-base font-semibold text-brand-600 tabular-nums">{c.value}</p>
                    <p className="text-[0.55rem] text-stone-500">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RSVP */}
            <div className="rounded-2xl bg-white p-3 ring-1 ring-brand-100">
              <p className="font-serif text-lg text-brand-950">{t('landing.phone.rsvp')}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[0.7rem] font-semibold">
                <span className="flex flex-col items-center gap-1 rounded-xl bg-brand-600 py-2.5 text-white">
                  <CircleCheck className="size-4" />
                  {t('landing.phone.attend')}
                </span>
                <span className="flex flex-col items-center gap-1 rounded-xl py-2.5 text-brand-950 ring-1 ring-brand-100">
                  <CircleX className="size-4" />
                  {t('landing.phone.decline')}
                </span>
              </div>
            </div>

            {/* QR */}
            <div className="rounded-2xl bg-white p-3 ring-1 ring-brand-100">
              <p className="font-serif text-lg text-brand-950">{t('landing.phone.qr')}</p>
              <div className="mx-auto mt-2 w-fit rounded-xl bg-white p-2 shadow-soft ring-1 ring-brand-100">
                <QrPattern />
              </div>
              <p className="mt-2 text-[0.65rem] text-stone-500">{t('landing.phone.qrHint')}</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Two moments from the event, floating beside the phone. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0, y: still ? 0 : [0, -6, 0] }}
        transition={{
          opacity: { delay: 0.8 },
          x: { delay: 0.8 },
          y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 },
        }}
        className="absolute top-[56%] -left-10 flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 shadow-lift ring-1 ring-brand-100 sm:-left-16"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-success-50 text-success-700">
          <CircleCheck className="size-4" />
        </span>
        <span className="text-left text-[0.7rem] leading-tight">
          <span className="block font-semibold text-brand-950">{t('landing.phone.toastRsvp')}</span>
          <span className="text-stone-500">{t('landing.phone.toastRsvpBody')}</span>
        </span>
      </motion.div>
      <motion.div
        aria-hidden
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0, y: still ? 0 : [0, 6, 0] }}
        transition={{
          opacity: { delay: 1.2 },
          x: { delay: 1.2 },
          y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.4 },
        }}
        className="absolute -right-8 bottom-2 flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 shadow-lift ring-1 ring-brand-100 sm:-right-14"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <ScanLine className="size-4" />
        </span>
        <span className="text-left text-[0.7rem] leading-tight">
          <span className="block font-semibold text-brand-950">{t('landing.phone.toastCheckin')}</span>
          <span className="text-stone-500">{t('landing.phone.toastCheckinBody')}</span>
        </span>
      </motion.div>
    </div>
  )
}
