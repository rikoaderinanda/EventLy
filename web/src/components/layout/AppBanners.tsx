import { Download, Share, WifiOff, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { isIosSafari, isStandalone, promptInstall, useInstallEvent, useOnline } from '@/shared/lib/pwa'

/**
 * A thin bar while the device is offline. The app is online-only (Q-9), so this explains why actions
 * fail instead of letting them look broken; it disappears by itself when the connection is back.
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnline()
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden bg-stone-800 text-white print:hidden"
        >
          <p className="flex items-center justify-center gap-2 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm">
            <WifiOff aria-hidden className="size-4 shrink-0" />
            {t('pwa.offline')}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const dismissKey = 'evently.install-dismissed-at'
const dismissDays = 30

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(dismissKey))
    return at > 0 && Date.now() - at < dismissDays * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

/**
 * "Pasang EventLy" card for organizers and staff: one tap where the browser supports it (Android, desktop
 * Chrome/Edge), the Share → Add to Home Screen steps on iPhone. Not shown once installed, and hidden for
 * 30 days after "Nanti".
 */
export function InstallPrompt({ className }: { className?: string }) {
  const { t } = useTranslation()
  const installEvent = useInstallEvent()
  const [hidden, setHidden] = useState(() => isStandalone() || recentlyDismissed())
  const ios = !installEvent && isIosSafari()
  const show = !hidden && (installEvent !== null || ios)

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(dismissKey, String(Date.now()))
    } catch {
      // Private mode: it just comes back next visit.
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          aria-label={t('pwa.installTitle')}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 30, stiffness: 320, delay: 0.6 }}
          className={cn(
            'fixed inset-x-3 z-40 mx-auto max-w-md rounded-2xl border border-brand-100 bg-white p-4 shadow-lift sm:inset-x-auto sm:right-6',
            className,
          )}
        >
          <div className="flex items-start gap-3">
            <img src="/icon.svg" alt="" className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-brand-950">{t('pwa.installTitle')}</p>
              <p className="mt-0.5 text-sm text-stone-500">
                {ios ? (
                  <>
                    {t('pwa.iosBefore')}{' '}
                    <Share
                      aria-label={t('pwa.share')}
                      className="inline size-4 align-text-bottom text-brand-600"
                    />{' '}
                    {t('pwa.iosAfter')}
                  </>
                ) : (
                  t('pwa.installBody')
                )}
              </p>
              {!ios && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon={Download} onClick={() => void promptInstall()}>
                    {t('pwa.install')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismiss}>
                    {t('pwa.later')}
                  </Button>
                </div>
              )}
            </div>
            <IconButton icon={X} label={t('ui.close')} size="sm" className="-mt-1 -mr-1" onClick={dismiss} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
