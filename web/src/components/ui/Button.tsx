import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { type ButtonVariant, type ButtonSize, type StyleProps, buttonClass } from './buttonClass'
import { cn } from './cn'
import { Spinner } from './Spinner'

type ContentProps = { icon?: LucideIcon; iconRight?: LucideIcon; loading?: boolean; children?: ReactNode }

function Content({ icon: Icon, iconRight: IconRight, loading, children }: ContentProps) {
  return (
    <>
      {loading ? <Spinner /> : Icon && <Icon aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight aria-hidden />}
    </>
  )
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleProps & ContentProps

/**
 * The one button of the app. `loading` keeps the label (so the button doesn't jump), shows a spinner and
 * disables it. Icon-only buttons need an `aria-label`.
 */
export function Button({
  variant,
  size,
  block,
  icon,
  iconRight,
  loading,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block }, className)}
      {...rest}
    >
      <Content icon={icon} iconRight={iconRight} loading={loading}>
        {children}
      </Content>
    </button>
  )
}

/** A router link styled as a button. */
export function ButtonLink({
  variant,
  size,
  block,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: LinkProps & StyleProps & Omit<ContentProps, 'loading'>) {
  return (
    <Link className={buttonClass({ variant, size, block }, className)} {...rest}>
      <Content icon={icon} iconRight={iconRight}>
        {children}
      </Content>
    </Link>
  )
}

/** Square icon button (toolbar, close). The label is required because there is no visible text. */
export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: LucideIcon
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  const square = { sm: 'w-9 px-0 pointer-coarse:w-11', md: 'w-11 px-0', lg: 'w-13 px-0' }[size]
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={buttonClass({ variant, size }, cn(square, className))}
      {...rest}
    >
      <Icon aria-hidden />
    </button>
  )
}
