import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '@/api/problem'
import { devSignIn, signInWithGoogle, useAuthConfig } from './api'
import { loadGoogleIdentity } from './google'
import { useSession } from './session-store'
import { homeForRole, type AuthResponse } from './types'

/** Only same-app paths are allowed as a post-login destination (no open redirect). */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

function GoogleButton({
  clientId,
  onCredential,
}: {
  clientId: string
  onCredential: (token: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const latestCallback = useRef(onCredential)
  const { i18n, t } = useTranslation()
  const [failed, setFailed] = useState(false)

  // Google keeps the first callback it was given, so route calls through a ref to the latest one.
  useEffect(() => {
    latestCallback.current = onCredential
  }, [onCredential])

  useEffect(() => {
    let cancelled = false
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !container.current) return
        google.initialize({ client_id: clientId, callback: (r) => latestCallback.current(r.credential) })
        google.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 300,
          locale: i18n.resolvedLanguage,
        })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId, i18n.resolvedLanguage])

  return failed ? (
    <p className="text-sm text-red-600">{t('auth.googleUnavailable')}</p>
  ) : (
    <div ref={container} className="flex min-h-11 justify-center" />
  )
}

function DevSignInForm({ onSignIn }: { onSignIn: (email: string, name: string) => Promise<void> }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await onSignIn(email, name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 space-y-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4"
    >
      <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">{t('auth.devTitle')}</p>
      <p className="text-xs text-amber-800">{t('auth.devHint')}</p>
      <label className="block text-sm">
        {t('auth.email')}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        {t('auth.name')}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-amber-600 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {t('auth.devSubmit')}
      </button>
    </form>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { status, user } = useSession()
  const config = useAuthConfig()
  const [error, setError] = useState<string | null>(null)
  const next = safeNext(params.get('next'))

  function done(response: AuthResponse) {
    navigate(next ?? homeForRole(response.user.role), { replace: true })
  }

  function fail(e: unknown) {
    // Error codes contain dots (auth.account_disabled); i18n keys use underscores instead.
    const key = (e instanceof ApiError ? e.code : 'unknown').replaceAll('.', '_')
    setError(t(`auth.errors.${key}`, { defaultValue: t('auth.errors.generic') }))
  }

  const onGoogleCredential = (idToken: string) => {
    setError(null)
    signInWithGoogle(idToken).then(done, fail)
  }

  if (status === 'authenticated' && user) {
    return <Navigate to={next ?? homeForRole(user.role)} replace />
  }

  return (
    <section className="mx-auto max-w-sm py-12 text-center">
      <h1 className="text-2xl font-semibold text-brand-900">{t('auth.title')}</h1>
      <p className="mt-2 text-stone-600">{t('auth.subtitle')}</p>

      <div className="mt-8">
        {config.isPending && <p className="text-sm text-stone-500">{t('auth.loading')}</p>}
        {config.isError && <p className="text-sm text-red-600">{t('auth.errors.generic')}</p>}
        {config.data?.googleClientId && (
          <GoogleButton clientId={config.data.googleClientId} onCredential={onGoogleCredential} />
        )}
        {config.data && !config.data.googleClientId && !config.data.devSignInEnabled && (
          <p className="text-sm text-stone-500">{t('auth.googleNotConfigured')}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {config.data?.devSignInEnabled && (
        <DevSignInForm
          onSignIn={async (email, name) => {
            setError(null)
            await devSignIn(email, name).then(done, fail)
          }}
        />
      )}

      <p className="mt-8 text-xs text-stone-500">{t('auth.help')}</p>
    </section>
  )
}
