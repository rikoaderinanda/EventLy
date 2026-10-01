import type { CSSProperties } from 'react'
import type { EventCategory } from '@/features/events/api'

export type InvitationTheme = 'Elegant' | 'Birthday' | 'Corporate'

export const invitationThemes: InvitationTheme[] = ['Elegant', 'Birthday', 'Corporate']

/** The theme a new event gets from its category (Q-62); the Owner can change it. Mirrors the server. */
export function themeForCategory(category: EventCategory): InvitationTheme {
  if (category === 'Birthday') return 'Birthday'
  if (category === 'Corporate') return 'Corporate'
  return 'Elegant'
}

/**
 * One invitation look. `primaryColor` and `secondaryColor` are the brand pair, `fontHeading` the class of
 * the heading face, `backgroundStyle` the page background; the remaining tokens keep text readable on it.
 * Every ink/surface pair passes WCAG AA (body text 4.5:1).
 */
export type ThemeDefinition = {
  primaryColor: string
  /** Text on the primary colour. */
  primaryInk: string
  secondaryColor: string
  fontHeading: string
  backgroundStyle: string
  surface: string
  ink: string
  muted: string
  line: string
  /** Light or dark: dark themes keep white QR tiles and light inputs readable. */
  scheme: 'light' | 'dark'
}

export const themes: Record<InvitationTheme, ThemeDefinition> = {
  // Wedding Elegant: cream and gold, Cormorant Garamond.
  Elegant: {
    primaryColor: '#9b5a43',
    primaryInk: '#ffffff',
    secondaryColor: '#c9a227',
    fontHeading: 'font-serif font-medium',
    backgroundStyle:
      'radial-gradient(1200px 600px at 50% -10%, #f3e3cc 0%, transparent 60%), radial-gradient(800px 500px at 100% 100%, #f6eccb 0%, transparent 55%), #faf7f2',
    surface: '#ffffff',
    ink: '#3d231b',
    muted: '#6f625a',
    line: '#eddcc8',
    scheme: 'light',
  },
  // Birthday: soft pastels, Playfair Display.
  Birthday: {
    primaryColor: '#b8336f',
    primaryInk: '#ffffff',
    secondaryColor: '#6d5fd0',
    fontHeading: 'font-display font-semibold',
    backgroundStyle:
      'radial-gradient(700px 500px at 0% 0%, #ffd9e8 0%, transparent 60%), radial-gradient(700px 500px at 100% 20%, #e3dcff 0%, transparent 60%), radial-gradient(800px 600px at 50% 100%, #d7f0ff 0%, transparent 60%), #fff8fb',
    surface: '#ffffff',
    ink: '#3b2346',
    muted: '#6e5f75',
    line: '#f3d7e6',
    scheme: 'light',
  },
  // Corporate: modern dark, Inter, gold accent.
  Corporate: {
    primaryColor: '#d4b062',
    primaryInk: '#15171c',
    secondaryColor: '#7dd3fc',
    fontHeading: 'font-sans font-semibold tracking-tight',
    backgroundStyle:
      'radial-gradient(900px 500px at 50% -10%, rgb(212 176 98 / 0.18) 0%, transparent 60%), radial-gradient(700px 500px at 100% 100%, rgb(125 211 252 / 0.10) 0%, transparent 60%), #0f1115',
    surface: '#181b22',
    ink: '#f3f4f6',
    muted: '#a8aebb',
    line: '#2a2f3a',
    scheme: 'dark',
  },
}

/** The theme as CSS custom properties, read by the invitation's `bg-(--inv-…)` / `text-(--inv-…)` classes. */
export function themeVariables(theme: ThemeDefinition): CSSProperties {
  return {
    '--inv-primary': theme.primaryColor,
    '--inv-primary-ink': theme.primaryInk,
    '--inv-secondary': theme.secondaryColor,
    '--inv-surface': theme.surface,
    '--inv-ink': theme.ink,
    '--inv-muted': theme.muted,
    '--inv-line': theme.line,
    colorScheme: theme.scheme,
  } as CSSProperties
}
