import { Pencil, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FeatureList } from '@/features/payments/EventPaymentSection'
import { formatMoney, type Package, type PackageFeatures } from '@/features/payments/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader, SectionHeader } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Switch, TextField } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Spinner'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import { useAllPackages, useSavePackage } from './api'

const numberFeatures = [
  'maxGuests',
  'maxPhotos',
  'maxStaff',
  'maxAdmins',
  'galleryRetentionDays',
  'maxGuestPhotosPerInvitation',
] as const satisfies readonly (keyof PackageFeatures)[]

const flagFeatures = [
  'guestUploadEnabled',
  'zipDownload',
  'excelExport',
  'wishesEnabled',
  'digitalGiftEnabled',
  'backgroundMusicEnabled',
  'countdownEnabled',
] as const satisfies readonly (keyof PackageFeatures)[]

const emptyFeatures: PackageFeatures = {
  maxGuests: 150,
  maxPhotos: 300,
  maxStaff: 2,
  maxAdmins: 1,
  galleryRetentionDays: 30,
  zipDownload: false,
  excelExport: false,
  guestUploadEnabled: false,
  maxGuestPhotosPerInvitation: 0,
  wishesEnabled: true,
  digitalGiftEnabled: true,
  backgroundMusicEnabled: true,
  countdownEnabled: true,
}

/** Create or edit a package. Changes apply to new checkouts; paid events keep what they paid for (Q-20). */
function PackageForm({ initial, onDone }: { initial: Package | null; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSavePackage()
  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [price, setPrice] = useState(String(initial?.price ?? ''))
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [features, setFeatures] = useState<PackageFeatures>(initial?.features ?? emptyFeatures)
  const errors = fieldErrors(save.error)

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      {
        id: initial?.id ?? null,
        code,
        input: { name, price: Number(price), currency: 'IDR', features, isActive },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form
      onSubmit={submit}
      aria-label={initial ? t('platform.editPackage', { name: initial.name }) : t('platform.newPackage')}
      className="space-y-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
    >
      <SectionHeader
        title={initial ? t('platform.editPackage', { name: initial.name }) : t('platform.newPackage')}
        level={2}
        className="mb-0"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          id="code"
          label={t('platform.packageCode')}
          hint={initial ? t('platform.codeFixed') : t('platform.codeHint')}
          required
          disabled={initial !== null}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
        />
        <TextField
          id="name"
          label={t('platform.packageName')}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <TextField
          id="price"
          label={t('platform.price')}
          type="number"
          min={1}
          step={1}
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.price}
        />
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-stone-800">{t('platform.limits')}</legend>
        {numberFeatures.map((key) => (
          <TextField
            key={key}
            id={key}
            label={t(`platform.featureLabel.${key}`)}
            type="number"
            min={0}
            required
            value={features[key]}
            onChange={(e) => setFeatures({ ...features, [key]: Number(e.target.value) })}
            // The server names nested fields "Features.MaxGuests"; fieldErrors only lowercases the first letter.
            error={errors[`features.${key.charAt(0).toUpperCase()}${key.slice(1)}`]}
          />
        ))}
      </fieldset>

      <fieldset className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-stone-800">{t('platform.flags')}</legend>
        {flagFeatures.map((key) => (
          <Switch
            key={key}
            label={t(`platform.featureLabel.${key}`)}
            checked={features[key]}
            onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })}
            className="border-b border-stone-100 py-2.5"
          />
        ))}
      </fieldset>

      <Switch
        label={t('platform.offered')}
        checked={isActive}
        onChange={(e) => setIsActive(e.target.checked)}
        className="rounded-xl bg-stone-50 px-4 py-3"
      />

      {save.isError && <Notice tone="danger">{errorMessage(t, save.error)}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
        <Button variant="ghost" icon={X} onClick={onDone}>
          {t('platform.close')}
        </Button>
      </div>
    </form>
  )
}

/** Root: the package catalog, including packages no longer offered. */
export function PackagesPage() {
  const { t, i18n } = useTranslation()
  const packages = useAllPackages()
  const [editing, setEditing] = useState<Package | 'new' | null>(null)

  return (
    <section className="mx-auto max-w-5xl space-y-5 py-6 sm:py-10">
      <PageHeader
        title={t('platform.packagesTitle')}
        subtitle={t('platform.packagesHint')}
        className="mb-0 sm:mb-0"
        actions={
          editing === null && (
            <Button icon={Plus} onClick={() => setEditing('new')} block="mobile">
              {t('platform.newPackage')}
            </Button>
          )
        }
      />

      {editing !== null && (
        <PackageForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {packages.isError && <Notice tone="danger">{errorMessage(t, packages.error)}</Notice>}
      {packages.isPending && <Skeleton className="h-64 rounded-2xl" />}
      <ul className="grid gap-4 md:grid-cols-3">
        {packages.data?.map((pkg) => (
          <li key={pkg.id} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-stone-900">{pkg.name}</p>
                <p className="font-mono text-xs text-stone-500">{pkg.code}</p>
              </div>
              {pkg.isActive ? (
                <Badge tone="success">{t('platform.offeredShort')}</Badge>
              ) : (
                <Badge>{t('platform.inactive')}</Badge>
              )}
            </div>
            <p className="mt-3 mb-4 text-2xl font-semibold tracking-tight text-stone-900 tabular-nums">
              {formatMoney(pkg.price, pkg.currency, i18n.language)}
            </p>
            <div className="flex-1">
              <FeatureList features={pkg.features} />
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              onClick={() => setEditing(pkg)}
              aria-label={t('platform.editPackage', { name: pkg.name })}
              className="mt-5 self-start"
            >
              {t('events.edit')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
