import type { EventTimeZone, LocalDateTime } from './api'

export const timeZoneLabel: Record<EventTimeZone, string> = {
  'Asia/Jakarta': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
}

/** Splits "2026-12-12T11:00:00" into the values of <input type="date"> and <input type="time">. */
export function splitLocal(value: LocalDateTime): { date: string; time: string } {
  return { date: value.slice(0, 10), time: value.slice(11, 16) }
}

export function joinLocal(date: string, time: string): LocalDateTime {
  return `${date}T${time || '00:00'}:00`
}

/**
 * Formats a venue-local time as written, without converting to the viewer's time zone:
 * 11:00 WITA stays 11:00 even for someone looking from Jakarta.
 */
export function formatLocal(value: LocalDateTime, locale: string, withDate = true): string {
  const [date = '', time = ''] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const asIfUtc = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0))
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    ...(withDate ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(asIfUtc)
}

/** The event date in the event's own time zone (list view). */
export function formatEventDate(utc: string, timeZone: EventTimeZone, locale: string): string {
  return `${new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(utc))} ${timeZoneLabel[timeZone]}`
}
