import { House } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { PublicHeader } from '@/components/layout/Header'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="px-4 py-12">
        <p aria-hidden className="text-center font-serif text-7xl font-medium text-brand-300">
          {notFound ? '404' : '!'}
        </p>
        <EmptyState
          className="pt-2"
          headingLevel={1}
          title={
            <span className="text-section">
              {notFound ? t('error.notFoundTitle') : t('error.genericTitle')}
            </span>
          }
          action={
            <ButtonLink to="/" variant="secondary" icon={House}>
              {t('error.back')}
            </ButtonLink>
          }
        />
      </main>
    </div>
  )
}
