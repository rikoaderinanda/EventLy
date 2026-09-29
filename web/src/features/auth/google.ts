/** Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client). */
type GoogleCredentialResponse = { credential: string }

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard'
      theme?: 'outline' | 'filled_blue'
      size?: 'large'
      text?: 'signin_with' | 'continue_with'
      shape?: 'pill' | 'rectangular'
      width?: number
      locale?: string
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const scriptUrl = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleAccountsId> | null = null

/** Loads the Google Identity Services script once. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  loading ??= new Promise((resolve, reject) => {
    if (window.google?.accounts.id) {
      resolve(window.google.accounts.id)
      return
    }
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.onload = () =>
      window.google?.accounts.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google Identity Services did not load.'))
    script.onerror = () => {
      loading = null
      reject(new Error('Google Identity Services could not be loaded.'))
    }
    document.head.appendChild(script)
  })
  return loading
}
