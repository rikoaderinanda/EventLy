import type { RouteObject } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { HomePage } from '@/features/home/HomePage'
import { ComingSoon } from '@/shared/components/ComingSoon'
import { AuthLayout, GuestLayout, OrganizerLayout, PlatformLayout, StaffLayout } from './layouts'
import { RouteError } from './RouteError'

/**
 * Route tree per role area (see docs/architecture/04-frontend-structure.md §4).
 * Placeholders are replaced by real feature pages phase by phase.
 * Guest invitation pages (/i/:code) are public: the invitation code is the guest's access.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'login', element: <LoginPage /> },
        ],
      },
      {
        path: 'app',
        element: <ProtectedRoute roles={['Owner', 'Admin']} />,
        children: [
          {
            element: <OrganizerLayout />,
            children: [{ index: true, element: <ComingSoon title="Dashboard" phase="Phase 3–4" /> }],
          },
        ],
      },
      {
        path: 'staff',
        element: <ProtectedRoute roles={['Staff', 'Owner']} />,
        children: [
          {
            element: <StaffLayout />,
            children: [{ index: true, element: <ComingSoon title="Scan QR" phase="Phase 8" /> }],
          },
        ],
      },
      {
        path: 'platform',
        element: <ProtectedRoute roles={['Root']} />,
        children: [
          {
            element: <PlatformLayout />,
            children: [{ index: true, element: <ComingSoon title="Paket & Owner" phase="Phase 5" /> }],
          },
        ],
      },
      {
        path: 'i/:code',
        element: <GuestLayout />,
        children: [{ index: true, element: <ComingSoon title="Undangan" phase="Phase 7" /> }],
      },
    ],
  },
]
