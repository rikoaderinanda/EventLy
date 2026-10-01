import { apiFetchFile } from '@/api/client'
import { saveBlob } from '@/shared/lib/image'

export type ReportKind = 'guests' | 'check-ins' | 'photos' | 'wishes' | 'gifts'
export type ReportFormat = 'csv' | 'xlsx'

export const reportKinds: ReportKind[] = ['guests', 'check-ins', 'photos', 'wishes', 'gifts']

/** Downloads one report (or, without a kind, every report in one workbook) under the server's file name. */
export async function downloadReport(eventId: string, kind: ReportKind | null, format: ReportFormat) {
  const path = kind ? `/events/${eventId}/reports/${kind}?format=${format}` : `/events/${eventId}/reports`
  const { blob, fileName } = await apiFetchFile(path)
  saveBlob(blob, fileName ?? `laporan-${kind ?? 'semua'}.${format}`)
}
