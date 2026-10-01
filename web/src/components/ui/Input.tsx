import { ChevronDown, CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react'
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react'
import { cn } from './cn'
import { Spinner } from './Spinner'

type FieldExtras = {
  label: string
  /** Helper text under the field; replaced by the error when there is one. */
  hint?: ReactNode
  error?: string | undefined
  /** Shows a green check (for example a value checked by the server). */
  valid?: boolean
  icon?: LucideIcon
  loading?: boolean
  /** Extra classes for the outer wrapper (width in a grid, margins). */
  wrapperClassName?: string
}

const box =
  'peer w-full rounded-xl border border-stone-300 bg-white text-body text-stone-900 transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none ' +
  'aria-invalid:border-danger-500 aria-invalid:focus:ring-danger-500/15 ' +
  'disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500'

// Floats above the value when the field has focus or a value, sits in the middle otherwise.
const floatingLabel =
  'pointer-events-none absolute top-1/2 -translate-y-1/2 origin-left text-body text-stone-500 transition-all duration-150 ease-out-soft ' +
  'peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-brand-700 ' +
  'peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium ' +
  'peer-aria-invalid:text-danger-700'

const fixedLabel =
  'pointer-events-none absolute top-2.5 text-xs font-medium text-stone-500 peer-focus:text-brand-700 peer-aria-invalid:text-danger-700'

// Shown with CSS so the label's text (its accessible name) stays exactly the label.
const required = "after:ml-0.5 after:text-brand-600 after:content-['*']"

// Inputs that always show something (a date mask, a file name) keep their label up.
const alwaysFloating = new Set(['date', 'datetime-local', 'time', 'month', 'week', 'file', 'color'])

function Messages({ id, hint, error }: { id: string; hint?: ReactNode; error?: string | undefined }) {
  if (error)
    return (
      <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1 text-xs text-danger-700">
        <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
        {error}
      </p>
    )
  if (hint)
    return (
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone-500">
        {hint}
      </p>
    )
  return null
}

function useFieldIds(
  id: string | undefined,
  name: string | undefined,
  hint: ReactNode,
  error: string | undefined,
) {
  const generated = useId()
  const fieldId = id ?? name ?? generated
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
  return { fieldId, describedBy }
}

function TrailingState({
  loading,
  valid,
  error,
}: {
  loading?: boolean
  valid?: boolean
  error?: string | undefined
}) {
  if (loading) return <Spinner className="absolute top-1/2 right-4 -translate-y-1/2 text-stone-400" />
  if (valid && !error)
    return (
      <CircleCheck
        aria-hidden
        className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-success-500"
      />
    )
  return null
}

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldExtras

/**
 * Text input with a floating label. The label is a real <label> (so `getByLabelText` and screen readers
 * work); the hint or error is linked with aria-describedby.
 */
export function TextField({
  label,
  hint,
  error,
  valid,
  icon: Icon,
  loading,
  wrapperClassName,
  id,
  className,
  placeholder,
  type = 'text',
  ...input
}: TextFieldProps) {
  const { fieldId, describedBy } = useFieldIds(id, input.name, hint, error)
  const fixed = alwaysFloating.has(type)
  return (
    <div className={cn('text-left', wrapperClassName)}>
      <div className="relative">
        <input
          id={fieldId}
          type={type}
          // The floating label needs :placeholder-shown, so there is always a placeholder; a real one only
          // appears once the label has moved up.
          placeholder={placeholder ?? ' '}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            box,
            'h-14 px-4 pt-5 pb-1.5 placeholder:text-transparent focus:placeholder:text-stone-400',
            type === 'file' &&
              'pt-6 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-2 file:py-0.5 file:text-brand-800',
            Icon && 'pl-11',
            (loading || valid) && 'pr-11',
            className,
          )}
          {...input}
        />
        <label
          htmlFor={fieldId}
          className={cn(
            fixed ? fixedLabel : floatingLabel,
            Icon ? 'left-11' : 'left-4',
            input.required && required,
          )}
        >
          {label}
        </label>
        {Icon && (
          <Icon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-stone-400 peer-focus:text-brand-600"
          />
        )}
        <TrailingState loading={loading} valid={valid} error={error} />
      </div>
      <Messages id={fieldId} hint={hint} error={error} />
    </div>
  )
}

export function TextArea({
  label,
  hint,
  error,
  wrapperClassName,
  id,
  className,
  rows = 4,
  ...textarea
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Omit<FieldExtras, 'icon' | 'loading' | 'valid'>) {
  const { fieldId, describedBy } = useFieldIds(id, textarea.name, hint, error)
  return (
    <div className={cn('text-left', wrapperClassName)}>
      <div className="relative">
        <textarea
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(box, 'block resize-y px-4 pt-7 pb-3', className)}
          {...textarea}
        />
        <label htmlFor={fieldId} className={cn(fixedLabel, 'left-4', textarea.required && required)}>
          {label}
        </label>
      </div>
      <Messages id={fieldId} hint={hint} error={error} />
    </div>
  )
}

export function Select({
  label,
  hint,
  error,
  icon: Icon,
  wrapperClassName,
  id,
  className,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & Omit<FieldExtras, 'loading' | 'valid'>) {
  const { fieldId, describedBy } = useFieldIds(id, select.name, hint, error)
  return (
    <div className={cn('text-left', wrapperClassName)}>
      <div className="relative">
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(box, 'h-14 appearance-none px-4 pt-5 pb-1.5 pr-10', Icon && 'pl-11', className)}
          {...select}
        >
          {children}
        </select>
        <label htmlFor={fieldId} className={cn(fixedLabel, Icon ? 'left-11' : 'left-4')}>
          {label}
        </label>
        {Icon && (
          <Icon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-stone-400"
          />
        )}
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-stone-500"
        />
      </div>
      <Messages id={fieldId} hint={hint} error={error} />
    </div>
  )
}

/** On/off switch built on a checkbox, so it keeps native keyboard and form behaviour. */
export function Switch({
  label,
  description,
  className,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4 py-1', className)}>
      <span className="min-w-0">
        <span className="block font-medium text-stone-800">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-stone-500">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" {...input} />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full bg-stone-300 transition-colors duration-200 peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 peer-disabled:opacity-50"
        />
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out-soft peer-checked:translate-x-5"
        />
      </span>
    </label>
  )
}
