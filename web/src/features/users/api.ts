import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { UserRole } from '@/features/auth/types'

export type OrganizationUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: UserRole
  status: 'Invited' | 'Active' | 'Disabled'
  lastSignInAt: string | null
  createdAt: string
}

export type MemberRole = 'Admin' | 'Staff'

export const userKeys = {
  all: ['users'] as const,
}

export function useUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: () => apiFetch<OrganizationUser[]>('/users') })
}

function useUsersMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useInviteUser() {
  return useUsersMutation((input: { name: string; email: string; role: MemberRole }) =>
    apiFetch<OrganizationUser>('/users', { method: 'POST', body: input }),
  )
}

export function useUpdateUser() {
  return useUsersMutation(
    ({ id, ...body }: { id: string; name: string; role: MemberRole; status: 'Active' | 'Disabled' }) =>
      apiFetch<OrganizationUser>(`/users/${id}`, { method: 'PUT', body }),
  )
}

export function useCancelInvitation() {
  return useUsersMutation((id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }))
}
