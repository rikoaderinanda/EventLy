import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuthConfig } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-store'
import { Field } from '@/shared/components/Field'
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
    <section className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold text-brand-900">{t('onboarding.title')}</h1>
      <p className="mt-2 text-stone-600">{t('onboarding.subtitle', { name: user?.name })}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field
          label={t('organization.name')}
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={t('organization.nameHint')}
          error={errors.name}
        />
        <Field
          label={t('organization.contactEmail')}
          name="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          error={errors.contactEmail}
        />
        <Field
          label={t('organization.contactPhone')}
          name="contactPhone"
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          error={errors.contactPhone}
        />

        <label className="flex items-start gap-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 size-4"
          />
          <span>
            {t('onboarding.acceptPrefix')}{' '}
            <Link to="/legal/terms" target="_blank" className="text-brand-700 underline">
              {t('legal.terms')}
            </Link>{' '}
            {t('onboarding.and')}{' '}
            <Link to="/legal/privacy" target="_blank" className="text-brand-700 underline">
              {t('legal.privacy')}
            </Link>
          </span>
        </label>

        {create.isError && !Object.keys(errors).length && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(t, create.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={!accepted || !config.data || create.isPending}
          className="w-full rounded-md bg-brand-700 px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {t('onboarding.submit')}
        </button>
      </form>
    </section>
  )
}
