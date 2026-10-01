import { useTranslation } from 'react-i18next'
import { ComingSoon } from '@/shared/components/ComingSoon'

/** Statistics of the selected event: built with the dashboard in UI-3 (Q-60). */
export function StatsPage() {
  const { t } = useTranslation()
  return <ComingSoon title={t('nav.analytics')} phase="UI-3" />
}
