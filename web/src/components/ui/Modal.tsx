import { X } from 'lucide-react'
import { AnimatePresence, motion, type PanInfo, useDragControls } from 'motion/react'
import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IconButton } from './Button'
import { cn } from './cn'
import { useIsDesktop } from './useIsDesktop'

const focusable =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Buttons at the bottom; on phones they stack full width. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Blocks closing with Escape, the backdrop or a swipe (while something is saving). */
  dismissible?: boolean
}

/**
 * Dialog that is a bottom sheet on phones (swipe down to close) and a centred modal from 640px.
 * Focus moves into the dialog, Tab stays inside, Escape closes, and focus returns to the opener.
 */
export function Modal({ open, onClose, ...rest }: ModalProps) {
  return createPortal(
    <AnimatePresence>{open && <ModalPanel onClose={onClose} {...rest} />}</AnimatePresence>,
    document.body,
  )
}

function ModalPanel({
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: Omit<ModalProps, 'open'>) {
  const { t } = useTranslation()
  const desktop = useIsDesktop()
  const panel = useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  const titleId = useId()
  const descriptionId = useId()
  const requestClose = () => {
    if (dismissible) onClose()
  }
  const onEscape = useEffectEvent(requestClose)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current
    first?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onEscape()
      } else if (event.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(focusable)]
        if (items.length === 0) return event.preventDefault()
        const [firstItem, lastItem] = [items[0]!, items[items.length - 1]!]
        if (
          event.shiftKey &&
          (document.activeElement === firstItem || document.activeElement === panel.current)
        ) {
          event.preventDefault()
          lastItem.focus()
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault()
          firstItem.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [])

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) requestClose()
  }

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-brand-950/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={requestClose}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col bg-white shadow-lift outline-none',
          'rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:rounded-2xl sm:pb-0',
          widths[size],
        )}
        initial={desktop ? { opacity: 0, y: 12, scale: 0.98 } : { y: '100%' }}
        animate={desktop ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
        exit={desktop ? { opacity: 0, y: 8, scale: 0.98 } : { y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 380 }}
        drag={!desktop && dismissible ? 'y' : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
      >
        {/* The grab bar and the header drag the sheet; the content keeps scrolling normally. */}
        <div className="shrink-0 touch-none sm:touch-auto" onPointerDown={(e) => !desktop && drag.start(e)}>
          {!desktop && <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-stone-300" />}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-card">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-stone-500">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <IconButton
                icon={X}
                label={t('ui.close')}
                size="sm"
                className="-mt-1 -mr-2"
                onClick={onClose}
              />
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-brand-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  )
}
