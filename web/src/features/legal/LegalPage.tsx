import ReactMarkdown from 'react-markdown'
import privacy from './content/kebijakan-privasi.md?raw'
import terms from './content/syarat-dan-ketentuan.md?raw'

const documents = { terms, privacy } as const

/** Renders the Terms or the Privacy Policy (Indonesian, the legally binding language). */
export function LegalPage({ document }: { document: keyof typeof documents }) {
  return (
    <article className="prose-legal mx-auto max-w-3xl py-8 text-sm leading-relaxed text-stone-700">
      <ReactMarkdown>{documents[document]}</ReactMarkdown>
    </article>
  )
}

// Route-level entry points, loaded lazily so the Markdown renderer isn't in the main bundle.
export function TermsPage() {
  return <LegalPage document="terms" />
}

export function PrivacyPage() {
  return <LegalPage document="privacy" />
}
