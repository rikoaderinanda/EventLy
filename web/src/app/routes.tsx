import type { RouteObject } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { HomePage } from '@/features/home/HomePage'
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
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/events/EventListPage')).EventListPage,
                }),
              },
              {
                path: 'events/new',
                lazy: async () => ({
                  Component: (await import('@/features/events/EventFormPage')).NewEventPage,
                }),
              },
              {
                path: 'events/:id',
                lazy: async () => ({
                  Component: (await import('@/features/events/EventDetailPage')).EventDetailPage,
                }),
              },
              {
                path: 'events/:id/edit',
                lazy: async () => ({
                  Component: (await import('@/features/events/EventFormPage')).EditEventPage,
                }),
              },
              {
                path: 'events/:id/guests',
                lazy: async () => ({
                  Component: (await import('@/features/guests/GuestListPage')).GuestListPage,
                }),
              },
              {
                path: 'events/:id/guests/new',
                lazy: async () => ({
                  Component: (await import('@/features/guests/GuestFormPage')).NewGuestPage,
                }),
              },
              {
                path: 'events/:id/guests/:guestId',
                lazy: async () => ({
                  Component: (await import('@/features/guests/GuestFormPage')).EditGuestPage,
                }),
              },
              {
                path: 'events/:id/rsvps',
                lazy: async () => ({
                  Component: (await import('@/features/responses/RsvpPage')).RsvpPage,
                }),
              },
              {
                path: 'events/:id/wishes',
                lazy: async () => ({
                  Component: (await import('@/features/responses/WishesPage')).WishesPage,
                }),
              },
              {
                path: 'events/:id/gifts',
                lazy: async () => ({
                  Component: (await import('@/features/responses/GiftsPage')).GiftsPage,
                }),
              },
              {
                path: 'events/:id/check-ins',
                lazy: async () => ({
                  Component: (await import('@/features/checkin/CheckInLogPage')).CheckInLogPage,
                }),
              },
              {
                path: 'events/:id/qr-sheet',
                lazy: async () => ({
                  Component: (await import('@/features/guests/QrSheetPage')).QrSheetPage,
                }),
              },
              {
                path: 'payments/:id',
                element: <ProtectedRoute roles={['Owner']} />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import('@/features/payments/PaymentPage')).PaymentPage,
                    }),
                  },
                  {
                    path: 'receipt',
                    lazy: async () => ({
                      Component: (await import('@/features/payments/ReceiptPage')).ReceiptPage,
                    }),
                  },
                ],
              },
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
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/events/StaffEventsPage')).StaffEventsPage,
                }),
              },
              {
                path: 'events/:id',
                lazy: async () => ({
                  Component: (await import('@/features/checkin/ScannerPage')).ScannerPage,
                }),
              },
            ],
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
              {
                path: 'owners/:id',
                lazy: async () => ({
                  Component: (await import('@/features/platform/OwnerDetailPage')).OwnerDetailPage,
                }),
              },
              {
                path: 'packages',
                lazy: async () => ({
                  Component: (await import('@/features/platform/PackagesPage')).PackagesPage,
                }),
              },
            ],
          },
        ],
      },
      {
        path: 'i/:code',
        element: <GuestLayout />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/features/invitation/InvitationPage')).InvitationPage,
            }),
          },
        ],
      },
    ],
  },
]
