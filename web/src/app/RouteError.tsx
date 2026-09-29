import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { AppShell } from './layouts/AppShell'

export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <AppShell>
      <section className="mx-auto max-w-md py-16 text-center">
        <p className="text-5xl font-bold text-brand-300">{notFound ? '404' : '!'}</p>
        <h1 className="mt-4 text-xl font-semibold text-brand-900">
          {notFound ? t('error.notFoundTitle') : t('error.genericTitle')}
        </h1>
        <Link to="/" className="mt-8 inline-block text-sm font-medium text-brand-700 underline">
          {t('error.back')}
        </Link>
      </section>
    </AppShell>
  )
}
