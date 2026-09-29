import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './session-store'
import { homeForRole, type UserRole } from './types'

/**
 * Lets a signed-in user with one of the given roles through. Anonymous users go to /login
 * (remembering where they were); users of another role go to their own home.
 * The API enforces permissions on every call; this only keeps the UI consistent.
 */
export function ProtectedRoute({
  roles,
  requireOrganization = false,
  children,
}: {
  roles: UserRole[]
  /** Owner/Admin/Staff areas need an organization; an Owner without one is sent to onboarding. */
  requireOrganization?: boolean
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const { status, user } = useSession()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-stone-500">
        {t('auth.loading')}
      </p>
    )
  }

  if (status === 'anonymous' || !user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />
  }

  if (requireOrganization && !user.organizationId) {
    return <Navigate to="/onboarding" replace />
  }

  return children ?? <Outlet />
}
