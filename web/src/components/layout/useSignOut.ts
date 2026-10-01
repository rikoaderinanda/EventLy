import { useNavigate } from 'react-router'
import { signOut } from '@/features/auth/api'

export function useSignOut() {
  const navigate = useNavigate()
  return () => void signOut().finally(() => navigate('/login', { replace: true }))
}
