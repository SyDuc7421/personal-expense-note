/** Monotonic updatedAt: max(now, previous + 1ms), so a new edit always wins even with clock skew. */
export function nextUpdatedAt(previous?: string, now: Date = new Date()): string {
  if (!previous) return now.toISOString()
  const bumped = new Date(previous).getTime() + 1
  return new Date(Math.max(now.getTime(), bumped)).toISOString()
}
