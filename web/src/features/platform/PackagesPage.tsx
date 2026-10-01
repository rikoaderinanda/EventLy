import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FeatureList } from '@/features/payments/EventPaymentSection'
import { formatMoney, type Package, type PackageFeatures } from '@/features/payments/api'
import { Field } from '@/shared/components/Field'
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
      className="space-y-4 rounded-lg border border-brand-100 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          id="code"
          label={t('platform.packageCode')}
          hint={initial ? t('platform.codeFixed') : t('platform.codeHint')}
          required
          disabled={initial !== null}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
        />
        <Field
          id="name"
          label={t('platform.packageName')}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Field
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
        <legend className="mb-2 text-sm font-medium text-stone-700">{t('platform.limits')}</legend>
        {numberFeatures.map((key) => (
          <Field
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

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-stone-700">{t('platform.flags')}</legend>
        {flagFeatures.map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={features[key]}
              onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })}
            />
            {t(`platform.featureLabel.${key}`)}
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {t('platform.offered')}
      </label>

      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(t, save.error)}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-4 py-2 text-sm text-stone-600 underline"
        >
          {t('platform.close')}
        </button>
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
    <section className="mx-auto max-w-4xl space-y-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-brand-900">{t('platform.packagesTitle')}</h1>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white"
          >
            {t('platform.newPackage')}
          </button>
        )}
      </div>
      <p className="text-sm text-stone-600">{t('platform.packagesHint')}</p>

      {editing !== null && (
        <PackageForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {packages.isError && <p className="text-red-700">{errorMessage(t, packages.error)}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {packages.data?.map((pkg) => (
          <li key={pkg.id} className="space-y-2 rounded-lg border border-brand-100 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-brand-900">
                {pkg.name} <span className="text-xs font-normal text-stone-500">{pkg.code}</span>
              </p>
              {!pkg.isActive && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  {t('platform.inactive')}
                </span>
              )}
            </div>
            <p className="text-lg font-medium text-stone-800">
              {formatMoney(pkg.price, pkg.currency, i18n.language)}
            </p>
            <FeatureList features={pkg.features} />
            <button
              type="button"
              onClick={() => setEditing(pkg)}
              aria-label={t('platform.editPackage', { name: pkg.name })}
              className="text-sm text-brand-700 underline"
            >
              {t('events.edit')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
