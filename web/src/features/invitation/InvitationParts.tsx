import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import { Reveal } from '@/components/ui/Reveal'
import { Spinner } from '@/components/ui/Spinner'

/** A thin flourish between blocks, in the theme's accent colour. */
export function Ornament({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 20"
      className={cn('mx-auto h-4 w-40 text-(--inv-secondary)', className)}
    >
      <path d="M0 10h78M122 10h78" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M100 2l6 8-6 8-6-8z" fill="currentColor" />
      <circle cx="84" cy="10" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="116" cy="10" r="2" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

/** An invitation block: a soft card on the theme surface, an icon, the title in the theme's heading face. */
export function InvitationSection({
  title,
  icon: Icon,
  headingClass,
  children,
  className,
}: {
  title: string
  icon?: LucideIcon
  headingClass: string
  children: ReactNode
  className?: string
}) {
  return (
    <Reveal>
      <section
        className={cn(
          'rounded-3xl bg-(--inv-surface) px-5 py-7 text-(--inv-ink) shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_40px_-16px_rgb(0_0_0/0.18)] ring-1 ring-(--inv-line) sm:px-8 sm:py-9',
          className,
        )}
      >
        <header className="mb-6 text-center">
          {Icon && (
            <Icon aria-hidden className="mx-auto mb-3 size-6 text-(--inv-secondary)" strokeWidth={1.5} />
          )}
          <h2 className={cn('text-3xl text-(--inv-ink)', headingClass)}>{title}</h2>
          <Ornament className="mt-3" />
        </header>
        {children}
      </section>
    </Reveal>
  )
}

type ThemeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'outline'
  icon?: LucideIcon
  loading?: boolean
}

/** Buttons in the theme's colours (the dashboard's terracotta buttons would clash with a pastel or dark theme). */
export function ThemeButton({
  variant = 'solid',
  icon: Icon,
  loading,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ThemeButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.9375rem] font-semibold transition-[filter,transform,background-color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variant === 'solid'
          ? 'bg-(--inv-primary) text-(--inv-primary-ink) shadow-[0_8px_24px_-10px_var(--inv-primary)] hover:brightness-110'
          : 'text-(--inv-primary) ring-1 ring-(--inv-primary) ring-inset hover:bg-(--inv-primary)/10',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : Icon && <Icon aria-hidden className="size-[1.125rem]" />}
      {children}
    </button>
  )
}
