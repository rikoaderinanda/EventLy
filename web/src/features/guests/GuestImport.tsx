import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch, apiFetchBlob } from '@/api/client'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Input'
import { ToolPanel } from '@/components/ui/ToolPanel'
import { errorMessage } from '@/shared/lib/errors'
import { guestKeys } from './api'

type ImportResult = {
  imported: number
  people: number
  errors: { line: number; name: string; messages: string[] }[]
}

function useImportGuests(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return apiFetch<ImportResult>(`/events/${eventId}/guests/import`, { method: 'POST', body: form })
    },
    onSuccess: (result) =>
      result.imported > 0 ? queryClient.invalidateQueries({ queryKey: guestKeys.list(eventId) }) : undefined,
  })
}

/** Saves the sample workbook; the download needs the access token, so it goes through fetch. */
async function downloadTemplate(eventId: string) {
  const url = URL.createObjectURL(await apiFetchBlob(`/events/${eventId}/guests/import-template`))
  const link = document.createElement('a')
  link.href = url
  link.download = 'template-tamu.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Excel guest import (Q-12). All or nothing: a file with mistakes imports nothing and lists every row
 * to fix. Names and WhatsApp numbers must be unique in the event (Q-55).
 */
export function GuestImport({ eventId }: { eventId: string }) {
  const { t } = useTranslation()
  const upload = useImportGuests(eventId)
  const input = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState(false)
  const [templateError, setTemplateError] = useState<unknown>(null)
  const result = upload.data

  function submit(e: FormEvent) {
    e.preventDefault()
    const file = input.current?.files?.[0]
    if (file) upload.mutate(file)
  }

  return (
    <ToolPanel title={t('guests.importTitle')} icon={FileSpreadsheet}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-stone-600">{t('guests.importHint')}</p>
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={() => void downloadTemplate(eventId).catch(setTemplateError)}
        >
          {t('guests.importTemplate')}
        </Button>
        {templateError !== null && <Notice tone="danger">{errorMessage(t, templateError)}</Notice>}
        <TextField
          id="guest-file"
          ref={input}
          type="file"
          label={t('guests.importFile')}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setChosen((e.target.files?.length ?? 0) > 0)}
        />
        <Button type="submit" size="sm" icon={Upload} loading={upload.isPending} disabled={!chosen}>
          {t('guests.importSubmit')}
        </Button>
      </form>

      {upload.isError && (
        <Notice tone="danger" className="mt-3">
          {errorMessage(t, upload.error)}
        </Notice>
      )}
      {result && result.errors.length === 0 && (
        <Notice tone="success" className="mt-3">
          {t('guests.importDone', { n: result.imported, people: result.people })}
        </Notice>
      )}
      {result && result.errors.length > 0 && (
        <Notice tone="danger" className="mt-3" title={t('guests.importFailed')}>
          <ul className="list-disc space-y-1 pl-5">
            {result.errors.map((error) => (
              <li key={error.line}>
                {t('guests.importLine', { line: error.line, name: error.name || '—' })}{' '}
                {error.messages.join(' ')}
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </ToolPanel>
  )
}
