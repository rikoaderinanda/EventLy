import { Building2, Mail, Phone, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Input'
import { useAuthConfig } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-store'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import { useCreateOrganization } from './api'

/** First step for a new Owner: create the organization and accept the Terms & Privacy Policy. */
export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const config = useAuthConfig()
  const create = useCreateOrganization()
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [accepted, setAccepted] = useState(false)

  if (user?.organizationId) {
    return <Navigate to="/app" replace />
  }

  const errors = fieldErrors(create.error)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!config.data) return
    create.mutate(
      {
        name,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        termsVersion: config.data.termsVersion,
      },
      { onSuccess: () => navigate('/app', { replace: true }) },
    )
  }

  return (
    <section className="mx-auto max-w-lg py-8 sm:py-14">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-gradient text-white shadow-primary">
          <Sparkles aria-hidden className="size-6" />
        </span>
        <p className="mt-5 text-sm font-medium text-brand-600">{t('onboarding.step')}</p>
        <h1 className="mt-1 text-page-responsive">{t('onboarding.title')}</h1>
        <p className="mt-3 text-stone-600">{t('onboarding.subtitle', { name: user?.name })}</p>
      </div>

      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-[2rem] border border-brand-100 bg-white p-6 shadow-lift sm:p-8"
      >
        <TextField
          label={t('organization.name')}
          name="name"
          icon={Building2}
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={t('organization.nameHint')}
          error={errors.name}
        />
        <TextField
          label={t('organization.contactEmail')}
          name="contactEmail"
          type="email"
          icon={Mail}
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          error={errors.contactEmail}
        />
        <TextField
          label={t('organization.contactPhone')}
          name="contactPhone"
          type="tel"
          icon={Phone}
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          error={errors.contactPhone}
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-600"
          />
          <span>
            {t('onboarding.acceptPrefix')}{' '}
            <Link to="/legal/terms" target="_blank" className="font-medium text-brand-700 underline">
              {t('legal.terms')}
            </Link>{' '}
            {t('onboarding.and')}{' '}
            <Link to="/legal/privacy" target="_blank" className="font-medium text-brand-700 underline">
              {t('legal.privacy')}
            </Link>
          </span>
        </label>

        {create.isError && !Object.keys(errors).length && (
          <Notice tone="danger">{errorMessage(t, create.error)}</Notice>
        )}

        <Button type="submit" size="lg" block disabled={!accepted || !config.data} loading={create.isPending}>
          {t('onboarding.submit')}
        </Button>
      </form>
    </section>
  )
}
