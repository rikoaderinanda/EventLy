import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type StyleProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Full width on phones only (`mobile`) or always (`true`). */
  block?: boolean | 'mobile'
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-gradient text-white shadow-primary hover:brightness-[1.06] hover:shadow-lift active:brightness-95',
  secondary:
    'border border-brand-200 bg-white/70 text-brand-800 hover:border-brand-300 hover:bg-white active:bg-brand-100',
  danger: 'border border-danger-100 bg-danger-50 text-danger-700 hover:bg-danger-100 active:bg-danger-100',
  ghost: 'text-stone-600 hover:bg-brand-100/70 hover:text-brand-900 active:bg-brand-100',
}

// sm stays 44px tall on touch screens (minimum touch target), compact only with a mouse.
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-sm pointer-coarse:h-11 [&_svg]:size-4',
  md: 'h-11 gap-2 rounded-xl px-4 text-[0.9375rem] [&_svg]:size-[1.125rem]',
  lg: 'h-13 gap-2.5 rounded-xl px-6 text-base [&_svg]:size-5',
}

/** Class names of a button, for elements that must look like one (links, file pickers). */
export function buttonClass(
  { variant = 'primary', size = 'md', block }: StyleProps = {},
  className?: string,
) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap select-none',
    'transition-[background-color,border-color,box-shadow,filter,transform] duration-150 ease-out-soft',
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    variants[variant],
    sizes[size],
    block === true && 'w-full',
    block === 'mobile' && 'w-full sm:w-auto',
    className,
  )
}
