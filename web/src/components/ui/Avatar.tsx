import { cn } from './cn'
import { initials } from './initials'

// Soft backgrounds with dark text: every pair passes WCAG AA for the initials.
const palettes = [
  'bg-brand-100 text-brand-800',
  'bg-gold-100 text-gold-700',
  'bg-success-50 text-success-700',
  'bg-sky-50 text-sky-800',
  'bg-violet-50 text-violet-800',
  'bg-rose-50 text-rose-800',
]

/** The same name always gets the same colour. */
function paletteOf(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0
  return palettes[Math.abs(hash) % palettes.length]!
}

/** Initials in a soft circle (guests have no photo). Decorative: the name is always written next to it. */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizes[size],
        paletteOf(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
