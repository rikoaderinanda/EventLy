import { useTranslation } from 'react-i18next'
import { locales, type Locale } from '@/config/env'
import { changeLocale } from '@/i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <label className="inline-flex items-center gap-2 text-sm text-stone-600">
      <span className="sr-only">{t('language')}</span>
      <select
        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
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
