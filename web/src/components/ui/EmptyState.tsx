import {
  CalendarHeart,
  Camera,
  Inbox,
  type LucideIcon,
  MessageCircleHeart,
  ReceiptText,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

export type EmptyKind = 'events' | 'guests' | 'payments' | 'photos' | 'wishes' | 'generic'

const icons: Record<EmptyKind, LucideIcon> = {
  events: CalendarHeart,
  guests: Users,
  payments: ReceiptText,
  photos: Camera,
  wishes: MessageCircleHeart,
  generic: Inbox,
}

/**
 * Small illustration: a soft champagne blob, a tilted "paper" card behind a front card holding the icon,
 * and a few gold sparkles. Pure SVG and CSS, so it costs nothing to load and follows the palette.
 */
function Illustration({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div aria-hidden className="relative mx-auto size-36">
      <svg viewBox="0 0 144 144" className="absolute inset-0 size-full">
        <path
          d="M72 10c26 0 52 14 58 40s-4 58-30 70-62 8-78-14S6 52 22 32 46 10 72 10Z"
          className="fill-brand-100"
        />
        <rect
          x="40"
          y="38"
          width="62"
          height="72"
          rx="12"
          transform="rotate(-8 71 74)"
          className="fill-brand-200/70"
        />
        <rect
          x="44"
          y="34"
          width="62"
          height="72"
          rx="12"
          className="fill-white stroke-brand-200"
          strokeWidth="1.5"
        />
        <rect x="56" y="88" width="38" height="5" rx="2.5" className="fill-brand-100" />
        <rect x="62" y="96" width="26" height="4" rx="2" className="fill-brand-100" />
        <path d="M118 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" className="fill-gold-500/80" />
        <path d="M26 96l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" className="fill-gold-300" />
        <circle cx="114" cy="104" r="3" className="fill-brand-300" />
      </svg>
      <div className="absolute top-[48px] left-[59px] flex size-8 items-center justify-center rounded-full bg-brand-50">
        <Icon className="size-[1.125rem] text-brand-600" strokeWidth={1.75} />
      </div>
    </div>
  )
}

/** What a list shows before it has anything: an illustration, one sentence why, and the next step. */
export function EmptyState({
  kind = 'generic',
  icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: {
  kind?: EmptyKind
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** 1 when the empty state is the whole page (error pages). */
  headingLevel?: 1 | 2 | 3
  className?: string
}) {
  const Heading = `h${headingLevel}` as const
  return (
    <div className={cn('mx-auto flex max-w-sm flex-col items-center px-4 py-10 text-center', className)}>
      <Illustration icon={icon ?? icons[kind]} />
      <Heading className="mt-4 text-card">{title}</Heading>
      {description && <p className="mt-1.5 text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
