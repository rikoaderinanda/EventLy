import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '@/features/auth/session-store'
import { Field } from '@/shared/components/Field'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import { useOrganization, useUpdateOrganization, type Organization } from './api'

function ProfileForm({ organization, canEdit }: { organization: Organization; canEdit: boolean }) {
  const { t } = useTranslation()
  const update = useUpdateOrganization()
  const [name, setName] = useState(organization.name)
  const [contactEmail, setContactEmail] = useState(organization.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(organization.contactPhone ?? '')
  const errors = fieldErrors(update.error)

  function submit(event: FormEvent) {
    event.preventDefault()
    update.mutate({ name, contactEmail: contactEmail || null, contactPhone: contactPhone || null })
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field
          label={t('organization.name')}
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
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
      </fieldset>

      {update.isError && !Object.keys(errors).length && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(t, update.error)}
        </p>
      )}
      {update.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          {t('common.saved')}
        </p>
      )}
      {canEdit && (
        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-md bg-brand-700 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {t('common.save')}
        </button>
      )}
    </form>
  )
}

export function OrganizationPage() {
  const { t } = useTranslation()
  const role = useSession((s) => s.user?.role)
  const { data, isPending, isError, error } = useOrganization()

  return (
    <section className="mx-auto max-w-xl py-8">
      <h1 className="text-2xl font-semibold text-brand-900">{t('organization.title')}</h1>
      {isPending && <p className="mt-4 text-stone-500">{t('common.loading')}</p>}
      {isError && <p className="mt-4 text-red-700">{errorMessage(t, error)}</p>}
      {data && (
        <>
          <p className="mt-1 text-sm text-stone-500">
            {t('organization.since', { date: new Date(data.createdAt).toLocaleDateString() })}
          </p>
          <ProfileForm key={data.id} organization={data} canEdit={role === 'Owner'} />
        </>
      )}
    </section>
  )
}
