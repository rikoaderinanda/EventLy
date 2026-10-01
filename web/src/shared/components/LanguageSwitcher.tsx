import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { locales, type Locale } from '@/config/env'
import { changeLocale } from '@/i18n'

/** Compact language select (ID / EN). */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <label className="relative inline-flex items-center text-sm text-stone-600">
      <span className="sr-only">{t('language')}</span>
      <Languages aria-hidden className="pointer-events-none absolute left-2.5 size-4 text-stone-400" />
      <select
        className="h-9 appearance-none rounded-lg border border-transparent bg-transparent pr-2.5 pl-8 text-sm font-medium text-stone-600 hover:border-brand-200 hover:bg-white focus:border-brand-300 pointer-coarse:h-11"
        value={i18n.resolvedLanguage}
        onChange={(e) => changeLocale(e.target.value as Locale)}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {locale.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  )
}
