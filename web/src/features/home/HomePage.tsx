import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSystemInfo } from '@/features/system/api'

const areaLinks = [
  { to: '/login', key: 'areas.login' },
  { to: '/app', key: 'areas.organizer' },
  { to: '/staff', key: 'areas.staff' },
  { to: '/i/contoh', key: 'areas.guest' },
  { to: '/platform', key: 'areas.platform' },
] as const

function ApiStatus() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useSystemInfo()

  const [dot, label] = isPending
    ? ['bg-stone-300', t('home.apiChecking')]
    : isError
      ? ['bg-red-500', t('home.apiOffline')]
      : ['bg-emerald-500', `${t('home.apiOnline')} · v${data.version} · ${data.environment}`]

  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-stone-600 shadow-sm">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      <span>
        {t('home.apiStatus')}: {label}
      </span>
    </p>
  )
}

export function HomePage() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto max-w-xl py-10">
      <h1 className="text-3xl font-semibold text-brand-900">{t('home.title')}</h1>
      <p className="mt-2 text-stone-600">{t('home.subtitle')}</p>
      <div className="mt-6">
        <ApiStatus />
      </div>

      <h2 className="mt-10 text-sm font-semibold tracking-wide text-stone-500 uppercase">
        {t('home.areas')}
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {areaLinks.map(({ to, key }) => (
          <li key={to}>
            <Link
              to={to}
              className="block rounded-lg border border-brand-100 bg-white px-4 py-3 font-medium text-brand-700 hover:border-brand-300"
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
