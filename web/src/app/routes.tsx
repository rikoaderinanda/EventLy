import type { RouteObject } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { HomePage } from '@/features/home/HomePage'
import { ComingSoon } from '@/shared/components/ComingSoon'
import { AuthLayout, GuestLayout, OrganizerLayout, PlatformLayout, StaffLayout } from './layouts'
import { RouteError } from './RouteError'

/**
 * Route tree per role area (see docs/architecture/04-frontend-structure.md §4).
 * Feature pages are lazy-loaded per area so the first load stays small.
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
          {
            path: 'legal/terms',
            lazy: async () => ({ Component: (await import('@/features/legal/LegalPage')).TermsPage }),
          },
          {
            path: 'legal/privacy',
            lazy: async () => ({ Component: (await import('@/features/legal/LegalPage')).PrivacyPage }),
          },
          {
            path: 'onboarding',
            element: <ProtectedRoute roles={['Owner']} />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/organization/OnboardingPage')).OnboardingPage,
                }),
              },
            ],
          },
        ],
      },
      {
        path: 'app',
        element: <ProtectedRoute roles={['Owner', 'Admin']} requireOrganization />,
        children: [
          {
            element: <OrganizerLayout />,
            children: [
              { index: true, element: <ComingSoon title="Dashboard" phase="Phase 4" /> },
              {
                path: 'organization',
                lazy: async () => ({
                  Component: (await import('@/features/organization/OrganizationPage')).OrganizationPage,
                }),
              },
              {
                path: 'users',
                element: <ProtectedRoute roles={['Owner']} />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await import('@/features/users/UsersPage')).UsersPage }),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'staff',
        element: <ProtectedRoute roles={['Staff', 'Owner']} requireOrganization />,
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
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/platform/OwnersPage')).OwnersPage,
                }),
              },
            ],
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
