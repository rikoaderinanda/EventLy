import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch, apiFetchBlob } from '@/api/client'
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
    <details className="rounded-lg border border-brand-100 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium text-brand-900">{t('guests.importTitle')}</summary>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <p className="text-stone-600">{t('guests.importHint')}</p>
        <button
          type="button"
          onClick={() => void downloadTemplate(eventId).catch(setTemplateError)}
          className="text-brand-700 underline"
        >
          {t('guests.importTemplate')}
        </button>
        {templateError !== null && <p className="text-red-700">{errorMessage(t, templateError)}</p>}
        <div>
          <label htmlFor="guest-file" className="block font-medium text-stone-700">
            {t('guests.importFile')}
          </label>
          <input
            id="guest-file"
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setChosen((e.target.files?.length ?? 0) > 0)}
            className="mt-1 block"
          />
        </div>
        <button
          type="submit"
          disabled={upload.isPending || !chosen}
          className="rounded-md bg-brand-700 px-3 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {t('guests.importSubmit')}
        </button>
      </form>

      {upload.isError && (
        <p role="alert" className="mt-3 text-red-700">
          {errorMessage(t, upload.error)}
        </p>
      )}
      {result && result.errors.length === 0 && (
        <p role="status" className="mt-3 text-emerald-700">
          {t('guests.importDone', { n: result.imported, people: result.people })}
        </p>
      )}
      {result && result.errors.length > 0 && (
        <div role="alert" className="mt-3 space-y-2 text-red-800">
          <p className="font-medium">{t('guests.importFailed')}</p>
          <ul className="list-disc space-y-1 pl-5">
            {result.errors.map((error) => (
              <li key={error.line}>
                {t('guests.importLine', { line: error.line, name: error.name || '—' })}{' '}
                {error.messages.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  )
}
