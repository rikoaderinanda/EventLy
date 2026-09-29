import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** Placeholder for an area whose pages arrive in a later phase. */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <p className="text-xs font-semibold tracking-widest text-brand-500 uppercase">
        {t('comingSoon.title')}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-brand-900">{title}</h1>
      <p className="mt-3 text-stone-600">{t('comingSoon.body', { phase })}</p>
      <Link to="/" className="mt-8 inline-block text-sm font-medium text-brand-700 underline">
        {t('comingSoon.back')}
      </Link>
    </section>
  )
}
