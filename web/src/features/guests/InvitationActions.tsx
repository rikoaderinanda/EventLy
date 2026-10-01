import { Check, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { errorMessage } from '@/shared/lib/errors'
import { fetchWhatsAppLink, type InvitationSummary } from './api'

/**
 * "Kirim via WhatsApp" and "Salin link" (decision Q-27). WhatsApp opens with the message ready; the
 * organizer still presses Send. The window is opened before the request so pop-up blockers allow it.
 */
export function InvitationActions({ invitation }: { invitation: InvitationSummary }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (invitation.status === 'Revoked') {
    return <span className="text-sm text-stone-500">{t('guests.revoked')}</span>
  }
  const url = invitation.url
  if (!url) {
    return <span className="text-sm text-stone-500">{t('guests.sendAfterPayment')}</span>
  }

  async function sendWhatsApp() {
    setError(null)
    const tab = window.open('', '_blank')
    try {
      const link = await fetchWhatsAppLink(invitation.id)
      if (tab) tab.location.href = link.url
      else window.location.assign(link.url)
    } catch (e) {
      tab?.close()
      setError(e)
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="success" icon={MessageCircle} onClick={() => void sendWhatsApp()}>
        {t('guests.sendWhatsApp')}
      </Button>
      <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={() => void copy(url)}>
        {copied ? t('guests.copied') : t('guests.copyLink')}
      </Button>
      {error !== null && <span className="text-sm text-danger-700">{errorMessage(t, error)}</span>}
    </div>
  )
}
