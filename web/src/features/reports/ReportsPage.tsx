import {
  Camera,
  FileSpreadsheet,
  FileText,
  Gift,
  Lock,
  type LucideIcon,
  MessageCircleHeart,
  ScanLine,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Loading } from '@/components/ui/Spinner'
import { useEvent } from '@/features/events/api'
import { EventPageHeader } from '@/features/events/EventPageHeader'
import { errorMessage } from '@/shared/lib/errors'
import { downloadReport, reportKinds, type ReportFormat, type ReportKind } from './api'

const icons: Record<ReportKind, LucideIcon> = {
  guests: Users,
  'check-ins': ScanLine,
  photos: Camera,
  wishes: MessageCircleHeart,
  gifts: Gift,
}

/**
 * Owner/Admin: download the event's reports (Phase 10). CSV for every package, Excel with the package's
 * excelExport (Q-2), and one workbook with every report (Q-70). Files open in Excel set to Indonesian.
 */
export function ReportsPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const event = useEvent(id)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const excel = event.data?.package?.features.excelExport === true

  async function download(kind: ReportKind | null, format: ReportFormat) {
    const key = `${kind ?? 'all'}-${format}`
    setBusy(key)
    setError(null)
    try {
      await downloadReport(id, kind, format)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5 py-6 sm:py-10">
      <EventPageHeader
        eventId={id}
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          excel && (
            <Button
              icon={FileSpreadsheet}
              loading={busy === 'all-xlsx'}
              disabled={busy !== null && busy !== 'all-xlsx'}
              onClick={() => void download(null, 'xlsx')}
              block="mobile"
            >
              {t('reports.downloadAll')}
            </Button>
          )
        }
      />

      {event.isPending && <Loading />}
      {event.data && !excel && (
        <Notice tone="info" title={t('reports.csvOnlyTitle')}>
          {t('reports.csvOnly')}
        </Notice>
      )}
      {error !== null && <Notice tone="danger">{errorMessage(t, error)}</Notice>}

      <ul className="space-y-3">
        {reportKinds.map((kind) => {
          const Icon = icons[kind]
          return (
            <li key={kind}>
              <Card padding="sm" className="flex flex-wrap items-center gap-4 sm:p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-card">{t(`reports.kind.${kind}.title`)}</h2>
                  <p className="mt-0.5 text-sm text-stone-500">{t(`reports.kind.${kind}.body`)}</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={FileText}
                    className="flex-1 sm:flex-none"
                    loading={busy === `${kind}-csv`}
                    disabled={busy !== null && busy !== `${kind}-csv`}
                    aria-label={t('reports.downloadAs', {
                      report: t(`reports.kind.${kind}.title`),
                      format: 'CSV',
                    })}
                    onClick={() => void download(kind, 'csv')}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={excel ? FileSpreadsheet : Lock}
                    className="flex-1 sm:flex-none"
                    loading={busy === `${kind}-xlsx`}
                    disabled={!excel || (busy !== null && busy !== `${kind}-xlsx`)}
                    title={excel ? undefined : t('reports.excelLocked')}
                    aria-label={t('reports.downloadAs', {
                      report: t(`reports.kind.${kind}.title`),
                      format: 'Excel',
                    })}
                    onClick={() => void download(kind, 'xlsx')}
                  >
                    Excel
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-stone-500">{t('reports.privacy')}</p>
    </section>
  )
}
