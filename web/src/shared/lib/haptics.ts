/**
 * Short vibrations for the scanner, so staff feel the result without looking (Android; iPhone Safari
 * has no Vibration API and simply ignores it). Patterns stay distinct: one tap, double tap, one long buzz.
 */
const patterns = {
  success: [60],
  repeat: [40, 60, 40],
  error: [220],
} as const

export function vibrate(kind: keyof typeof patterns) {
  try {
    navigator.vibrate?.(patterns[kind] as unknown as number[])
  } catch {
    // Some browsers throw when vibration isn't allowed (no user gesture yet); nothing to do.
  }
}
