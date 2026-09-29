import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { useSession } from '@/features/auth/session-store'
import type { CurrentUser } from '@/features/auth/types'

export type Organization = {
  id: string
  name: string
  contactEmail: string | null
  contactPhone: string | null
  status: 'Active' | 'Suspended'
  createdAt: string
}

export type OrganizationInput = {
  name: string
  contactEmail: string | null
  contactPhone: string | null
}

type CreateOrganizationResponse = {
  organization: Organization
  accessToken: string
  expiresIn: number
  user: CurrentUser
}

export const organizationKeys = {
  current: ['organization'] as const,
}

export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.current,
    queryFn: () => apiFetch<Organization>('/organization'),
  })
}

/** Onboarding. The response carries a new access token that includes the organization. */
export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OrganizationInput & { termsVersion: string }) =>
      apiFetch<CreateOrganizationResponse>('/organization', {
        method: 'POST',
        body: { ...input, acceptTerms: true },
      }),
    onSuccess: (response) => {
      useSession.getState().signIn({
        accessToken: response.accessToken,
        expiresIn: response.expiresIn,
        user: response.user,
        isNewUser: false,
      })
      queryClient.setQueryData(organizationKeys.current, response.organization)
    },
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OrganizationInput) =>
      apiFetch<Organization>('/organization', { method: 'PUT', body: input }),
    onSuccess: (organization) => queryClient.setQueryData(organizationKeys.current, organization),
  })
}
