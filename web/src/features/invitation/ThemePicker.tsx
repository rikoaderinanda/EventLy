import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/components/ui/cn'
import './fonts'
import { invitationThemes, themes, type InvitationTheme } from './themes'

/** A small sample of each theme (background, heading face, colours), so the choice is visual. */
function Preview({ theme }: { theme: InvitationTheme }) {
  const look = themes[theme]
  return (
    <div
      aria-hidden
      className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl"
      style={{ background: look.backgroundStyle }}
    >
      <span className="text-[0.625rem] tracking-[0.25em] uppercase" style={{ color: look.muted }}>
        Save the date
      </span>
      <span className={cn('text-2xl leading-none', look.fontHeading)} style={{ color: look.ink }}>
        Rina &amp; Budi
      </span>
      <span className="mt-1 flex gap-1">
        <span className="size-2.5 rounded-full" style={{ background: look.primaryColor }} />
        <span className="size-2.5 rounded-full" style={{ background: look.secondaryColor }} />
      </span>
    </div>
  )
}

/** Invitation theme choice in the event form (Q-62): a radio group of previews. */
export function ThemePicker({
  value,
  onChange,
}: {
  value: InvitationTheme
  onChange: (theme: InvitationTheme) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-stone-700">{t('themes.label')}</legend>
      <p className="mb-3 text-xs text-stone-500">{t('themes.hint')}</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {invitationThemes.map((theme) => {
          const selected = theme === value
          return (
            <label
              key={theme}
              className={cn(
                'relative cursor-pointer rounded-2xl border p-1.5 transition-[border-color,box-shadow] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600',
                selected
                  ? 'border-brand-500 shadow-lift ring-2 ring-brand-100'
                  : 'border-stone-200 hover:border-brand-200',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={selected}
                onChange={() => onChange(theme)}
                className="sr-only"
              />
              <Preview theme={theme} />
              <span className="mt-1.5 block px-1 pb-0.5 text-center text-xs font-medium text-stone-700 sm:text-sm">
                {t(`themes.${theme}`)}
              </span>
              {selected && (
                <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check aria-hidden className="size-3.5" />
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
