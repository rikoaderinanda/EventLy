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

## Organizer pages (UI-3)

- **Dashboard** (`/app`, `features/dashboard`): greeting with the week's active events; a hero card of the event in focus (the selected one, else the next upcoming) with cover, date, place, people and RSVP progress; four quick actions (add event, manage guests, scan check-in, statistics); four numbers (total guests, RSVP answered with a ring, checked in with a mini chart, wishes); other events as cards.
- **Statistics** (`/app/events/:id/stats`): reach (opened), answers (stacked bar with legend), attendance, check-ins per hour (one-hue bar chart with a hover value and a screen-reader table), wishes, gift confirmations with the total amount, photos, staff, package quota. Built from `GET /events/{id}/stats`.
- **Events**: card grid with cover, category, status, date, venue, people and RSVP progress, filtered by stage (all, active, draft, finished).
- **Event detail**: cover banner, badges, actions, a tile grid of the sections with their current number, a session timeline, package and payment, staff assignment.
- **Guests**: table from 640px, cards below (one or the other is rendered, chosen with `useIsDesktop`), search and filters, collapsible tools (WhatsApp message, Excel import), quota bar.
- **Every sub-page** uses `EventPageHeader` (back to the event, title, subtitle, actions), `Notice` for messages, `EmptyState` for empty lists and skeletons while loading.
- **Charts** follow the dataviz rules: status colours only for status and always with an icon and a word; one hue for a single series; marks at least 3:1 against the surface; values in text, not in the series colour.
- **Long words** (an e-mail as a name) wrap in headings (`overflow-wrap: anywhere`), so they never widen the page on a phone.

## Staff scanner (UI-4)

- **Own layout** (`ScannerLayout`): full screen on near-black (`stone-950`), no app bar, so the camera and the result stand out at a dark venue. The staff event list keeps the normal frame and shows Active events first, each with its check-in progress and a large "Buka scanner check-in" button.
- **Top:** back, event name, the counter and a green progress bar of people arrived.
- **Scanner:** rounded camera view with four corner brackets and a moving gold scan line (hidden with reduced motion). The camera stays on while a result shows.
- **Bottom:** three large tabs (64px): Scan QR, Cari tamu, Riwayat saya. Manual entry and history sit on white panels for contrast.
- **Result:** a bottom sheet (`Modal`): a status mark that pops in (green check, amber warning for a repeat, red for invalid), the guest's name large, the type, warnings, the photo step, and one main button that already has focus, so Enter (or a Bluetooth scanner) confirms.
- **Haptics** (`shared/lib/haptics.ts`): one short buzz for a new check-in, a double tap for a repeat scan, one long buzz for an invalid invitation (Android; iPhone Safari has no Vibration API).
- **Staff camera** (`CameraCapture`) renders through a portal above the sheet; Escape closes only the camera.

## Guest invitation and themes (UI-5)

- **Themes** (`features/invitation/themes.ts`, Q-62): `Elegant` (cream and gold, Cormorant Garamond), `Birthday` (pastels, Playfair Display), `Corporate` (modern dark, Inter, gold accent). Each theme object has `primaryColor`, `secondaryColor`, `fontHeading` and `backgroundStyle`, plus surface, ink, muted and line colours so text stays at WCAG AA on it. The page sets them as CSS variables (`--inv-primary`, `--inv-surface`, …) and the blocks use `bg-(--inv-…)` / `text-(--inv-…)`. The event's `theme` column defaults from the category; the event form has a visual picker (a new event follows its category until the Owner picks a theme). All themes in every package.
- **Cover:** full screen; the cover photo with a slow zoom and a dark gradient, or the theme background. Category eyebrow, the event name in the heading face, the date, an ornament, "Kepada Yth." and the guest, and "Buka Undangan". Opening slides the cover up (0.9 s); while it slides it is `inert` and `aria-hidden`. The tap also starts the music (Q-43).
- **Blocks** (rounded-3xl cards on the theme surface, fading in as they scroll into view with `Reveal`, not at all with reduced motion): hero, story (the description, Q-63), countdown, schedule (names and times), location (each place once with its sessions and a Google Maps button), RSVP (two large choices), QR (always on white, so any scanner reads it), the guest's photos after check-in, wishes, digital gift (accounts with copy, QRIS, address, optional confirmation). A floating music button.
- **Headings** inside a theme set their colour on the element: the global `h1–h3` colour would otherwise win over the inherited theme ink.

## Public, sign-in and Root pages (UI-6)

- **Landing** (`/`): hero with the promise, two calls to action and a live miniature invitation, four feature cards, legal links; the server status stays as a small pill.
- **Sign in:** a brand panel (desktop) beside the sign-in card with Google and, in development, the test form.
- **Onboarding** and **legal** pages on the same cards and inputs.
- **Root** (enterprise minimal): neutral stone borders, dense rows with column headers on the Owner list, plain package cards with the feature checklist, switches for the package flags, manual activation inline.
- Legacy components (`StatusBadge`, `PaymentStatusBadge`, `RsvpBadge`, `Field`, `ComingSoon`) are gone: every page uses `components/`.

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
