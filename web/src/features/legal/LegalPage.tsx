import ReactMarkdown from 'react-markdown'
import privacy from './content/kebijakan-privasi.md?raw'
import terms from './content/syarat-dan-ketentuan.md?raw'

const documents = { terms, privacy } as const

/** Renders the Terms or the Privacy Policy (Indonesian, the legally binding language). */
export function LegalPage({ document }: { document: keyof typeof documents }) {
  return (
    <article className="prose-legal mx-auto my-6 max-w-3xl rounded-[2rem] border border-brand-100 bg-white px-6 py-8 text-[0.9375rem] leading-relaxed text-stone-700 shadow-soft sm:my-10 sm:px-12 sm:py-12">
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
