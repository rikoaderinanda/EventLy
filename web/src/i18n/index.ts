import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { env, locales, type Locale } from '@/config/env'
import en from './en.json'
import id from './id.json'

const storageKey = 'evently.locale'

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored && (locales as readonly string[]).includes(stored)) {
      return stored as Locale
    }
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return env.defaultLocale
}

void i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
})

export function changeLocale(locale: Locale) {
  void i18n.changeLanguage(locale)
  document.documentElement.lang = locale
  try {
    localStorage.setItem(storageKey, locale)
  } catch {
    // Ignore: the choice just won't be remembered.
  }
}

export default i18n
