import { OfflineBanner } from '@/components/layout/AppBanners'
import '@/features/invitation/fonts'
import { DashboardPreview } from './DashboardPreview'
import { Faq } from './Faq'
import { Features } from './Features'
import { FinalCta } from './FinalCta'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { Pricing } from './Pricing'
import { Problems } from './Problems'

/**
 * The public marketing page (/). The order follows the visitor's questions: what is it, why do I need it,
 * what does it do, how does it work, what does it look like, what does it cost, and the remaining doubts.
 * Only facts about the real product; no testimonials, logos or usage numbers.
 */
export function LandingPage() {
  return (
    // overflow-x-clip: the hero's floating cards never cause sideways scrolling on a phone.
    <div className="min-h-dvh overflow-x-clip">
      <OfflineBanner />
      <LandingHeader />
      <main>
        <Hero />
        <Problems />
        <Features />
        <HowItWorks />
        <DashboardPreview />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
