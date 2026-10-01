import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import { Reveal } from '@/components/ui/Reveal'

/** A landing section: an anchor id, generous spacing, and the same width everywhere. */
export function LandingSection({
  id,
  labelledBy,
  children,
  className,
}: {
  id?: string
  labelledBy: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24', className)}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

/** Eyebrow, serif title and subtitle, centred; the title's id names the section for screen readers. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  className,
}: {
  id: string
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  className?: string
}) {
  return (
    <Reveal className={cn('mx-auto max-w-2xl text-center', className)}>
      {eyebrow && (
        <p className="text-xs font-semibold tracking-[0.25em] text-brand-600 uppercase">{eyebrow}</p>
      )}
      <h2 id={id} className="mt-3 font-display text-3xl leading-tight font-semibold sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg text-stone-600">{subtitle}</p>}
    </Reveal>
  )
}
