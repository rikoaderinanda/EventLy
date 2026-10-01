/** "Andi Pratama" → "AP": first letters of the first and last word. */
export function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0]!
  const last = words.length > 1 ? words[words.length - 1]! : ''
  return (first[0]! + (last[0] ?? '')).toUpperCase()
}
