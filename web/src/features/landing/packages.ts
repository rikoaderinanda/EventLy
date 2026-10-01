/**
 * The packages shown on the landing page. These are the seed values (Q-37); Root can change the real
 * prices in the app, and the price that applies is always the one shown at checkout. Update this file
 * when the offer changes (the package API needs a signed-in user, so the public page doesn't read it).
 */
export type LandingPackage = {
  code: 'BASIC' | 'PREMIUM' | 'ENTERPRISE'
  name: string
  price: number
  guests: number
  photos: number
  staff: number
  admins: number
  retentionDays: number
  zip: boolean
  /** Photos a guest may take per invitation; 0 = no guest camera. */
  guestPhotos: number
  excel: boolean
}

export const landingPackages: LandingPackage[] = [
  {
    code: 'BASIC',
    name: 'Basic',
    price: 150_000,
    guests: 150,
    photos: 300,
    staff: 2,
    admins: 1,
    retentionDays: 30,
    zip: false,
    guestPhotos: 0,
    excel: false,
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    price: 350_000,
    guests: 500,
    photos: 1_500,
    staff: 5,
    admins: 2,
    retentionDays: 90,
    zip: true,
    guestPhotos: 5,
    excel: true,
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    price: 1_000_000,
    guests: 5_000,
    photos: 10_000,
    staff: 20,
    admins: 5,
    retentionDays: 365,
    zip: true,
    guestPhotos: 10,
    excel: true,
  },
]
