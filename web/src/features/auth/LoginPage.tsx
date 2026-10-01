import { FlaskConical, Mail, ScanLine, ShieldCheck, Sparkles, User } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '@/api/problem'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Spinner'
import '@/features/invitation/fonts'
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
    <Notice tone="warning">{t('auth.googleUnavailable')}</Notice>
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
      className="space-y-3 rounded-2xl border border-dashed border-warning-500/50 bg-warning-50/70 p-4 text-left"
    >
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-warning-700 uppercase">
        <FlaskConical aria-hidden className="size-4" />
        {t('auth.devTitle')}
      </p>
      <p className="text-xs text-warning-700">{t('auth.devHint')}</p>
      <TextField
        id="dev-email"
        label={t('auth.email')}
        type="email"
        icon={Mail}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        id="dev-name"
        label={t('auth.name')}
        icon={User}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" block loading={busy}>
        {t('auth.devSubmit')}
      </Button>
    </form>
  )
}

/** The brand side of the sign-in page (desktop): what the app does, in three lines. */
function BrandPanel() {
  const { t } = useTranslation()
  const points = [
    { icon: Sparkles, text: t('auth.point.invite') },
    { icon: ScanLine, text: t('auth.point.checkin') },
    { icon: ShieldCheck, text: t('auth.point.secure') },
  ]
  return (
    <div className="relative hidden overflow-hidden rounded-[2rem] bg-linear-to-br from-brand-700 via-brand-800 to-brand-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-gold-300/20 blur-3xl" />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-16 size-80 rounded-full bg-brand-400/30 blur-3xl"
      />
      <p className="relative text-xs tracking-[0.35em] text-white/70 uppercase">EventLy</p>
      <div className="relative">
        <p className="font-serif text-5xl leading-tight font-medium text-white">{t('auth.brandTitle')}</p>
        <ul className="mt-8 space-y-4">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white/90">
              <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
                <Icon aria-hidden className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-white/60">{t('auth.brandFoot')}</p>
    </div>
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
    <section className="mx-auto grid max-w-5xl gap-8 py-6 sm:py-10 lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-brand-100 bg-white p-6 text-center shadow-lift sm:p-8">
          <img src="/icon.svg" alt="" className="mx-auto size-12 rounded-2xl shadow-primary" />
          <h1 className="mt-5 text-section">{t('auth.title')}</h1>
          <p className="mt-2 text-sm text-stone-600">{t('auth.subtitle')}</p>

          <div className="mt-7">
            {config.isPending && <Loading label={t('auth.loading')} className="py-4" />}
            {config.isError && <Notice tone="danger">{t('auth.errors.generic')}</Notice>}
            {config.data?.googleClientId && (
              <GoogleButton clientId={config.data.googleClientId} onCredential={onGoogleCredential} />
            )}
            {config.data && !config.data.googleClientId && !config.data.devSignInEnabled && (
              <Notice>{t('auth.googleNotConfigured')}</Notice>
            )}
          </div>

          {error && (
            <Notice tone="danger" className="mt-4 text-left">
              {error}
            </Notice>
          )}

          {config.data?.devSignInEnabled && (
            <div className="mt-6">
              <DevSignInForm
                onSignIn={async (email, name) => {
                  setError(null)
                  await devSignIn(email, name).then(done, fail)
                }}
              />
            </div>
          )}

          <p className="mt-6 text-xs text-stone-500">{t('auth.help')}</p>
        </div>
      </div>
    </section>
  )
}
