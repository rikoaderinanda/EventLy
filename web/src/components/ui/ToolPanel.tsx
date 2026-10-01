import { ChevronDown, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** A collapsible tool panel (message template, Excel import), closed by default to keep the list first. */
export function ToolPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <details className="group rounded-2xl border border-brand-100 bg-white shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icon aria-hidden className="size-[1.125rem]" />
        </span>
        <span className="flex-1 font-medium text-brand-950">{title}</span>
        <ChevronDown
          aria-hidden
          className="size-4 text-stone-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-brand-100 px-4 py-4 text-sm">{children}</div>
    </details>
  )
}
