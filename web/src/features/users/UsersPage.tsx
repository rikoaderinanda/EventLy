import { Mail, Power, PowerOff, User, UserPlus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, SectionHeader } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Select, TextField } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Spinner'
import { errorMessage, fieldErrors } from '@/shared/lib/errors'
import {
  useCancelInvitation,
  useInviteUser,
  useUpdateUser,
  useUsers,
  type MemberRole,
  type OrganizationUser,
} from './api'

const statusTone: Record<OrganizationUser['status'], BadgeTone> = {
  Active: 'success',
  Invited: 'warning',
  Disabled: 'neutral',
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
    <Card as="section">
      <form onSubmit={submit}>
        <SectionHeader title={t('users.inviteTitle')} description={t('users.inviteHint')} level={2} />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem]">
          <TextField
            label={t('users.name')}
            name="name"
            icon={User}
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <TextField
            label={t('users.googleEmail')}
            name="email"
            type="email"
            icon={Mail}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Select
            label={t('users.role')}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
          >
            <option value="Staff">{t('roles.Staff')}</option>
            <option value="Admin">{t('roles.Admin')}</option>
          </Select>
        </div>
        {invite.isError && !Object.keys(errors).length && (
          <Notice tone="danger" className="mt-3">
            {errorMessage(t, invite.error)}
          </Notice>
        )}
        <Button type="submit" icon={UserPlus} loading={invite.isPending} block="mobile" className="mt-4">
          {t('users.inviteSubmit')}
        </Button>
      </form>
    </Card>
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
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
      <Avatar name={user.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-brand-950">{user.name}</p>
        <p className="truncate text-sm text-stone-500">{user.email}</p>
        {error && <p className="text-xs text-danger-700">{errorMessage(t, error)}</p>}
      </div>
      <Badge tone={statusTone[user.status]}>{t(`users.status.${user.status}`)}</Badge>
      {editable ? (
        <select
          aria-label={t('users.roleOf', { name: user.name })}
          value={user.role}
          disabled={update.isPending}
          onChange={(e) => change({ role: e.target.value as MemberRole })}
          className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm hover:border-stone-400 pointer-coarse:h-11"
        >
          <option value="Staff">{t('roles.Staff')}</option>
          <option value="Admin">{t('roles.Admin')}</option>
        </select>
      ) : (
        <Badge tone="brand">{t(`roles.${user.role}`)}</Badge>
      )}
      {editable && user.status === 'Invited' && (
        <Button
          variant="ghost"
          size="sm"
          icon={X}
          className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
          onClick={() => cancel.mutate(user.id)}
        >
          {t('users.cancelInvite')}
        </Button>
      )}
      {editable && user.status !== 'Invited' && (
        <Button
          variant="ghost"
          size="sm"
          icon={user.status === 'Disabled' ? Power : PowerOff}
          onClick={() => change({ status: user.status === 'Disabled' ? 'Active' : 'Disabled' })}
        >
          {user.status === 'Disabled' ? t('users.enable') : t('users.disable')}
        </Button>
      )}
    </li>
  )
}

/** Owner only: Admin and Staff of the organization, invited by their Google email. */
export function UsersPage() {
  const { t } = useTranslation()
  const { data, isPending, isError, error } = useUsers()

  return (
    <section className="mx-auto max-w-4xl space-y-6 py-6 sm:py-10">
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
      <InviteForm />
      {isPending && <Skeleton className="h-40 rounded-2xl" />}
      {isError && <Notice tone="danger">{errorMessage(t, error)}</Notice>}
      {data && (
        <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
          {data.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </ul>
      )}
    </section>
  )
}
