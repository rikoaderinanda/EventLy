export type UserRole = 'Root' | 'Owner' | 'Admin' | 'Staff'

export type CurrentUser = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: UserRole
  status: 'Invited' | 'Active' | 'Disabled'
  organizationId: string | null
  permissions: string[]
}

export type AuthResponse = {
  accessToken: string
  expiresIn: number
  user: CurrentUser
  isNewUser: boolean
}

export type AuthConfig = {
  googleClientId: string | null
  devSignInEnabled: boolean
}

/** Where each role lands after signing in. */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case 'Root':
      return '/platform'
    case 'Staff':
      return '/staff'
    default:
      return '/app'
  }
}
