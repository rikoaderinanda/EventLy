import type { InputHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | undefined
  hint?: string
}

/**
 * Labelled text input. The hint and error sit outside the <label> and are linked with
 * aria-describedby, so the accessible name is just the label.
 */
export function Field({ label, error, hint, id, ...input }: FieldProps) {
  const inputId = id ?? input.name
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="text-left text-sm">
      <label htmlFor={inputId} className="font-medium text-stone-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 aria-invalid:border-red-500"
        {...input}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
