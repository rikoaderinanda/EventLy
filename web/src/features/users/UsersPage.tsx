import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/shared/components/Field'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import {
  useCancelInvitation,
  useInviteUser,
  useUpdateUser,
  useUsers,
  type MemberRole,
  type OrganizationUser,
} from './api'

const statusStyle: Record<OrganizationUser['status'], string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Invited: 'bg-amber-50 text-amber-800',
  Disabled: 'bg-stone-100 text-stone-500',
}

function InviteForm() {
  const { t } = useTranslation()
  const invite = useInviteUser()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('Staff')
  const errors = fieldErrors(invite.error)

  function submit(event: FormEvent) {
    event.preventDefault()
    invite.mutate(
      { name, email, role },
      {
        onSuccess: () => {
          setName('')
          setEmail('')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand-100 bg-white p-4">
      <h2 className="font-semibold text-brand-900">{t('users.inviteTitle')}</h2>
      <p className="mt-1 text-sm text-stone-500">{t('users.inviteHint')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field
          label={t('users.name')}
          name="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Field
          label={t('users.googleEmail')}
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <label className="block text-left text-sm">
          <span className="font-medium text-stone-700">{t('users.role')}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
          >
            <option value="Staff">{t('roles.Staff')}</option>
            <option value="Admin">{t('roles.Admin')}</option>
          </select>
        </label>
      </div>
      {invite.isError && !Object.keys(errors).length && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {errorMessage(t, invite.error)}
        </p>
      )}
      <button
        type="submit"
        disabled={invite.isPending}
        className="mt-4 rounded-md bg-brand-700 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {t('users.inviteSubmit')}
      </button>
    </form>
  )
}

function UserRow({ user }: { user: OrganizationUser }) {
  const { t } = useTranslation()
  const update = useUpdateUser()
  const cancel = useCancelInvitation()
  const editable = user.role === 'Admin' || user.role === 'Staff'
  const error = update.error ?? cancel.error

  function change(patch: Partial<{ role: MemberRole; status: 'Active' | 'Disabled' }>) {
    update.mutate({
      id: user.id,
      name: user.name,
      role: (patch.role ?? user.role) as MemberRole,
      status: patch.status ?? (user.status === 'Disabled' ? 'Disabled' : 'Active'),
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-800">{user.name}</p>
        <p className="truncate text-sm text-stone-500">{user.email}</p>
        {error && <p className="text-xs text-red-700">{errorMessage(t, error)}</p>}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[user.status]}`}>
        {t(`users.status.${user.status}`)}
      </span>
      {editable ? (
        <select
          aria-label={t('users.roleOf', { name: user.name })}
          value={user.role}
          disabled={update.isPending}
          onChange={(e) => change({ role: e.target.value as MemberRole })}
          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
        >
          <option value="Staff">{t('roles.Staff')}</option>
          <option value="Admin">{t('roles.Admin')}</option>
        </select>
      ) : (
        <span className="text-sm text-stone-600">{t(`roles.${user.role}`)}</span>
      )}
      {editable && user.status === 'Invited' && (
        <button
          type="button"
          onClick={() => cancel.mutate(user.id)}
          className="text-sm text-red-700 underline"
        >
          {t('users.cancelInvite')}
        </button>
      )}
      {editable && user.status !== 'Invited' && (
        <button
          type="button"
          onClick={() => change({ status: user.status === 'Disabled' ? 'Active' : 'Disabled' })}
          className="text-sm text-stone-700 underline"
        >
          {user.status === 'Disabled' ? t('users.enable') : t('users.disable')}
        </button>
      )}
    </li>
  )
}

/** Owner only: Admin and Staff of the organization, invited by their Google email. */
export function UsersPage() {
  const { t } = useTranslation()
  const { data, isPending, isError, error } = useUsers()

  return (
    <section className="mx-auto max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold text-brand-900">{t('users.title')}</h1>
      <InviteForm />
      {isPending && <p className="text-stone-500">{t('common.loading')}</p>}
      {isError && <p className="text-red-700">{errorMessage(t, error)}</p>}
      {data && (
        <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white px-4">
          {data.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </ul>
      )}
    </section>
  )
}
