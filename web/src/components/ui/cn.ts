/** Joins class names, skipping empty values. Tailwind classes are written so they never need merging. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
