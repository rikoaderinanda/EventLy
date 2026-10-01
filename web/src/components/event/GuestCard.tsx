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
  /** Second line, e.g. the WhatsApp number. */
  detail?: ReactNode
}

/** A guest in the phone layout of the guest list (desktop keeps the table). */
export function GuestCard({ to, name, people, rsvp, checkedInAt, detail }: GuestCardProps) {
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-soft transition-colors hover:border-brand-200 active:bg-brand-50"
    >
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-brand-950">{name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-stone-500">
          {people > 1 && (
            <span className="inline-flex items-center gap-1">
              <UsersRound aria-hidden className="size-3.5" />
              {t('ui.guest.people', { count: people })}
              {detail && ' ·'}
            </span>
          )}
          {detail}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <RsvpBadge status={rsvp} />
          <CheckInBadge checkedInAt={checkedInAt} />
        </div>
      </div>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-stone-400" />
    </Link>
  )
}
