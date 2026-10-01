import { ChevronRight, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { CheckInBadge, RsvpBadge } from '@/components/ui/Badge'

export type GuestCardProps = {
  to: string
  name: string
  /** People on the invitation (a group invitation counts several). */
  people: number
  rsvp: string
  checkedInAt: string | null
  /** Second line, e.g. the guest type and WhatsApp number. */
  detail?: ReactNode
  /** Buttons under the card (send, copy); they sit above the card's link. */
  actions?: ReactNode
}

/**
 * A guest in the phone layout of the guest list (desktop keeps the table). The name is the link and its
 * hit area covers the card, so the whole card opens the guest while the action buttons stay separate.
 */
export function GuestCard({ to, name, people, rsvp, checkedInAt, detail, actions }: GuestCardProps) {
  const { t } = useTranslation()
  return (
    <div className="relative rounded-2xl border border-brand-100 bg-white p-4 shadow-soft transition-colors hover:border-brand-200">
      <div className="flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <Link
            to={to}
            className="block truncate font-semibold text-brand-950 after:absolute after:inset-0 after:rounded-2xl"
          >
            {name}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-stone-500">
            {people > 1 && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <UsersRound aria-hidden className="size-3.5" />
                {t('ui.guest.people', { count: people })}
                {detail && ' ·'}
              </span>
            )}
            {detail && <span className="truncate">{detail}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <RsvpBadge status={rsvp} />
            <CheckInBadge checkedInAt={checkedInAt} />
          </div>
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-stone-400" />
      </div>
      {actions && <div className="relative z-10 mt-3 border-t border-brand-100 pt-3">{actions}</div>}
    </div>
  )
}
