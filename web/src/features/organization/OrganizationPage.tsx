import { Building2, Mail, Phone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Spinner'
import { useSession } from '@/features/auth/session-store'
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
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={!canEdit} className="space-y-4">
          <TextField
            label={t('organization.name')}
            name="name"
            icon={Building2}
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        </fieldset>

        {update.isError && !Object.keys(errors).length && (
          <Notice tone="danger">{errorMessage(t, update.error)}</Notice>
        )}
        {update.isSuccess && <Notice tone="success">{t('common.saved')}</Notice>}
        {!canEdit && <Notice>{t('organization.ownerOnly')}</Notice>}
        {canEdit && (
          <Button type="submit" loading={update.isPending} block="mobile">
            {t('common.save')}
          </Button>
        )}
      </form>
    </Card>
  )
}

export function OrganizationPage() {
  const { t, i18n } = useTranslation()
  const role = useSession((s) => s.user?.role)
  const { data, isPending, isError, error } = useOrganization()

  return (
    <section className="mx-auto max-w-2xl py-6 sm:py-10">
      <PageHeader
        title={t('organization.title')}
        subtitle={
          data &&
          t('organization.since', { date: new Date(data.createdAt).toLocaleDateString(i18n.language) })
        }
      />
      {isPending && <Loading />}
      {isError && <Notice tone="danger">{errorMessage(t, error)}</Notice>}
      {data && <ProfileForm key={data.id} organization={data} canEdit={role === 'Owner'} />}
    </section>
  )
}
