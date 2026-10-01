import type { PublicGifts, PublicInvitation, PublicWish, PublicWishPage, RsvpStatus } from './api'
import type { InvitationTheme } from './themes'

/**
 * The marketing demo (/i/demo): a fictional invitation that runs entirely in the browser. No request
 * reaches the server; RSVP, wishes and gift confirmations only change this page's memory. Real codes are
 * 22 characters, so "demo" can never be a guest's code.
 */
export const DEMO_CODE = 'demo'

export const isDemo = (code: string) => code === DEMO_CODE

const wishes: PublicWish[] = [
  {
    guestName: 'Keluarga Santoso',
    message:
      'Selamat menempuh hidup baru, Rina & Budi. Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.',
    createdAt: '2026-10-01T03:00:00Z',
    isMine: false,
  },
  {
    guestName: 'Dewi & Arif',
    message: 'Bahagia selalu! Sampai jumpa di hari bahagia kalian.',
    createdAt: '2026-09-28T10:30:00Z',
    isMine: false,
  },
]

let state: { invitation: PublicInvitation; wishes: PublicWish[] } | null = null

function initial(): PublicInvitation {
  return {
    guestName: 'Bapak Andi Pratama',
    type: 'Group',
    numberOfPeople: 2,
    event: {
      name: 'Rina & Budi',
      category: 'Wedding',
      description:
        'Dengan memohon rahmat dan ridho Tuhan Yang Maha Esa, kami bermaksud menyelenggarakan pernikahan kami. Merupakan suatu kehormatan apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.',
      timeZone: 'Asia/Jakarta',
      status: 'Active',
      coverUrl: null,
      theme: 'Elegant',
      sessions: [
        {
          name: 'Akad Nikah',
          startsAt: '2026-12-20T01:00:00Z',
          endsAt: '2026-12-20T03:00:00Z',
          startsAtLocal: '2026-12-20T08:00:00',
          endsAtLocal: '2026-12-20T10:00:00',
          venue: 'Masjid Agung, Jakarta',
          mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Jakarta',
          isCheckInSession: false,
        },
        {
          name: 'Resepsi',
          startsAt: '2026-12-20T04:00:00Z',
          endsAt: '2026-12-20T07:00:00Z',
          startsAtLocal: '2026-12-20T11:00:00',
          endsAtLocal: '2026-12-20T14:00:00',
          venue: 'Gedung Serbaguna, Jakarta',
          mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Jakarta',
          isCheckInSession: true,
        },
      ],
    },
    rsvp: { status: 'Pending', respondedAt: null, isOpen: true, closesAt: '2026-12-20T07:00:00Z' },
    features: { countdown: true, wishes: true, wishesOpen: true, digitalGift: true, backgroundMusic: false },
    myWish: null,
    checkedIn: false,
  }
}

function current() {
  state ??= { invitation: initial(), wishes: [...wishes] }
  return state
}

/** Fresh demo data for every visit to the page (and every test). */
export function resetDemo() {
  state = null
}

export const demo = {
  invitation: async (): Promise<PublicInvitation> => structuredClone(current().invitation),
  setTheme(theme: InvitationTheme) {
    current().invitation.event.theme = theme
  },
  rsvp: async (status: Exclude<RsvpStatus, 'Pending'>) => {
    const rsvp = { ...current().invitation.rsvp, status, respondedAt: new Date().toISOString() }
    current().invitation.rsvp = rsvp
    return rsvp
  },
  wishes: async (): Promise<PublicWishPage> => ({ wishes: [...current().wishes], page: 1, hasMore: false }),
  wish: async (message: string): Promise<PublicWish> => {
    const wish: PublicWish = {
      guestName: current().invitation.guestName,
      message,
      createdAt: new Date().toISOString(),
      isMine: true,
    }
    current().wishes = [wish, ...current().wishes.filter((w) => !w.isMine)]
    current().invitation.myWish = message
    return wish
  },
  gifts: async (): Promise<PublicGifts> => ({
    accounts: [
      { kind: 'Bank', provider: 'Bank Contoh', accountNumber: '1234 5678 90', accountHolder: 'Rina Lestari' },
    ],
    address: null,
    qrisUrl: null,
  }),
  confirmGift: async () => undefined,
}
