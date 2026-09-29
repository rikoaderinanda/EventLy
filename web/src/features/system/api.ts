import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'

export type SystemInfo = {
  name: string
  version: string
  environment: string
  serverTime: string
}

export const systemKeys = {
  info: ['system', 'info'] as const,
}

export function useSystemInfo() {
  return useQuery({
    queryKey: systemKeys.info,
    queryFn: () => apiFetch<SystemInfo>('/system/info'),
    retry: false,
  })
}
