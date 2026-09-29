import type { RouteObject } from 'react-router'
import { HomePage } from '@/features/home/HomePage'
import { ComingSoon } from '@/shared/components/ComingSoon'
import { AuthLayout, GuestLayout, OrganizerLayout, PlatformLayout, StaffLayout } from './layouts'
import { RouteError } from './RouteError'

/**
 * Route tree per role area (see docs/architecture/04-frontend-structure.md §4).
 * Placeholders are replaced by real feature pages phase by phase; access guards arrive in Phase 2.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'login', element: <ComingSoon title="Masuk dengan Google" phase="Phase 2" /> },
        ],
      },
      {
        path: 'app',
        element: <OrganizerLayout />,
        children: [{ index: true, element: <ComingSoon title="Dashboard" phase="Phase 3–4" /> }],
      },
      {
        path: 'staff',
        element: <StaffLayout />,
        children: [{ index: true, element: <ComingSoon title="Scan QR" phase="Phase 8" /> }],
      },
      {
        path: 'platform',
        element: <PlatformLayout />,
        children: [{ index: true, element: <ComingSoon title="Paket & Owner" phase="Phase 5" /> }],
      },
      {
        path: 'i/:code',
        element: <GuestLayout />,
        children: [{ index: true, element: <ComingSoon title="Undangan" phase="Phase 7" /> }],
      },
    ],
  },
]
