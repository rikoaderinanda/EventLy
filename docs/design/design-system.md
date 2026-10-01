# EventLy Design System

> Since the UI redesign (Q-58, 2026-10-01). Code: `web/src/components/` · tokens in `web/src/styles/index.css` · live gallery at **`/dev/ui`** (development only, not in production builds).

## Personalities

One palette and one component set, but each area has its own character:

| Area | Character | What that means |
|---|---|---|
| Organizer dashboard (`/app`) | Modern SaaS, clean, productive | Whitespace, few cards, clear hierarchy, sidebar on desktop and bottom nav on phones |
| Staff scanner (`/staff`) | Functional, fast, high contrast | Full screen, large targets, instant feedback (animation, vibration) |
| Guest invitation (`/i/:code`) | Emotional, luxury, memorable | Serif headings, cover with opening animation, per-event theme |
| Platform admin (`/platform`) | Enterprise minimal | Dense tables, neutral colours |

## Colour

Warm cream background, deep terracotta for actions, champagne and gold for highlights. Nothing saturated.

| Token | Value | Use |
|---|---|---|
| `brand-50` | `#FAF7F2` cream | Page background |
| `brand-100` / `-200` | `#F4ECE2` / `#EDDCC8` | Hairlines, soft fills |
| `brand-300` | `#E8C9A5` champagne | Highlights, selection |
| `brand-600` | `#9B5A43` deep terracotta | Primary action (gradient `500 → 600 → 700`), links, focus ring |
| `brand-900` | `#6F4032` warm brown | Strong text accents |
| `brand-950` | `#3D231B` | Headings |
| `gold-500` | `#C9A227` | Accent (sparkles, premium badge) |
| `success-500` / `warning-500` / `danger-500` | `#3F8F6B` / `#C58A25` / `#B94A48` | Status; text uses the `-700` shade on a `-50` fill for contrast |
| stone (Tailwind) | `#78716C` = `stone-500` | Secondary text |

Status is never shown by colour alone: badges always have a word and an icon.

## Typography

- **Inter** (variable, self-hosted via `@fontsource-variable`) everywhere.
- **Cormorant Garamond** (`font-serif`) and **Playfair Display** (`font-display`) only on the invitation pages; imported in `features/invitation/fonts.ts` so the dashboard doesn't download them.
- Fonts are self-hosted, not Google Fonts: the PWA works without a third party, and visitors' IPs aren't sent to Google.

| Token | Size | Use |
|---|---|---|
| `text-page-responsive` | 32px, 40px from `md` | Page title (`PageHeader`) |
| `text-section` | 24px | Section title |
| `text-card` | 18px | Card title |
| `text-body` | 15px, line height 1.6 | Body (default on `body`) |

## Components

| Component | File | Notes |
|---|---|---|
| `Button`, `ButtonLink`, `IconButton` | `ui/Button.tsx` (classes in `ui/buttonClass.ts`) | Variants primary (gradient), secondary, danger, ghost. Sizes sm/md/lg; `sm` is 44px on touch screens. `block` / `block="mobile"` for full width. `loading` keeps the label, shows a spinner and disables. Icon-only buttons require a label |
| `Card`, `SectionHeader`, `PageHeader` | `ui/Card.tsx` | White, hairline border, soft shadow, `rounded-2xl`; `interactive` lifts on hover |
| `Badge`, `EventStatusBadge`, `RsvpBadge`, `PaymentBadge`, `CheckInBadge` | `ui/Badge.tsx` | Status → tone + icon + translated word in one place |
| `TextField`, `TextArea`, `Select`, `Switch` | `ui/Input.tsx` | Floating label (a real `<label>`), icon, hint, error (`aria-invalid` + `aria-describedby`), valid check, loading. Required marker drawn with CSS so the accessible name stays the label. `Switch` is a checkbox with `role="switch"`. The old `shared/components/Field` re-exports `TextField` |
| `Modal` | `ui/Modal.tsx` | Bottom sheet on phones (drag the handle down to close), centred from 640px. Focus moves in, Tab is trapped, Escape closes, focus returns to the opener; `dismissible={false}` while saving |
| `EmptyState` | `ui/EmptyState.tsx` | SVG illustration in the palette + title + one sentence + next action. Kinds: events, guests, payments, photos, wishes, generic |
| `Notice` | `ui/Feedback.tsx` | Inline info/success/warning/danger; danger is `role="alert"` |
| `ProgressRing`, `ProgressBar`, `MiniBars` | `ui/Feedback.tsx` | Rings and bars are `role="progressbar"` with values; mini charts are decorative |
| `Loading`, `Spinner`, `Skeleton` | `ui/Spinner.tsx` | |
| `Avatar` | `ui/Avatar.tsx` | Initials on a soft colour, stable per name (Q-64) |
| `EventCard` | `event/EventCard.tsx` | Cover (or a category gradient), category, status, date, venue, guests, RSVP progress |
| `GuestCard` | `event/GuestCard.tsx` | Phone layout of the guest list |
| `StatisticCard` | `event/StatisticCard.tsx` | Icon, label, value, caption or trend, optional ring/chart |

## App frame (UI-2)

`components/layout/` and `app/layouts/index.tsx`:

| Area | Desktop (from 1024px) | Phone and tablet |
|---|---|---|
| Organizer `/app` | `Sidebar`: logo, event picker, Dashboard · Acara · *Kelola acara* (Tamu, Check-in, Pembayaran, Statistik) · Organisasi · Pengguna (Owner) · Pengaturan; collapsible to icons (remembered per browser). `TopBar`: language and the account menu | `MobileHeader`: mark, slim event picker, avatar → profile. `MobileNavigation`: Beranda · Acara · Tamu · Statistik · Profil |
| Platform `/platform` | Sidebar: Owner · Paket · Pengaturan | Bottom nav: Owner · Paket · Profil |
| Staff `/staff` | Slim bar (logo, language, account); the scanner gets its own full-screen design in UI-4 | Same |
| Public, guest | `PublicHeader` (logo, language); the invitation has no app chrome | Same |

- **Selected event (Q-59):** `features/events/selected-event.ts`. The user's last choice (stored per user id in `localStorage`, ids only), else the only Active event, else the only event. Opening any `/app/events/:id/...` page selects that event. With a real choice to make, the event menus open the picker (`EventPickerProvider`, a `Modal`) and then the chosen event's page; switching events keeps the same kind of page.
- **New pages:** `/app/events` (list; `/app` becomes the dashboard in UI-3), `/app/events/:id/payments`, `/app/events/:id/stats` (placeholder until UI-3), and `/app|/staff|/platform/settings` (profile, language, links, sign out; Q-65).
- **PWA:** `shared/lib/pwa.ts` catches the browser's install event at start-up. `InstallPrompt` (organizer and staff) offers "Pasang" where the browser supports it and the Share → "Tambah ke Layar Utama" steps on iPhone Safari; hidden once installed and for 30 days after "Nanti". `OfflineBanner` (every area) says changes can't be saved while offline (the app is online-only, Q-9). `index.html` shows a splash (icon on cream) until React renders. Theme colour is the cream background, so the status bar blends with the header.

## Motion

- **Motion** (`motion/react`, MIT) for the modal, sheet and invitation opening; CSS transitions for hover and press.
- Short and soft: 150–250 ms, easing `ease-out-soft` (`cubic-bezier(0.22, 1, 0.36, 1)`), springs for sheets.
- `MotionConfig reducedMotion="user"` in the providers: the device's "reduce motion" setting is respected. Tests skip animations (`MotionGlobalConfig.skipAnimations`).

## Icons

**Lucide** (`lucide-react`, ISC). Icons accompany text or carry an `aria-label`; decorative icons are `aria-hidden`.

## Accessibility rules

- Semantic elements first (`button`, `a`, `label`, headings in order).
- One visible focus ring for keyboard users (`:focus-visible`, terracotta, offset 2px).
- Touch targets at least 44px on touch screens.
- Text contrast at least WCAG AA: primary `#9B5A43` on white is 5.3:1, on cream 5.0:1.
- Loading and disabled states on every action; `aria-busy` on loading buttons.

## Libraries

| Library | Licence | Why |
|---|---|---|
| `lucide-react` | ISC | Icons |
| `motion` | MIT | Animations |
| `@fontsource-variable/inter`, `cormorant-garamond`, `playfair-display` | OFL-1.1 | Self-hosted fonts |

No component library (shadcn, MUI): the set is small, and owning it keeps the look consistent and the bundle small.
