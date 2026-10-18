export type ShareOutcome = 'shared' | 'copied' | 'cancelled'

/** Web Share sheet when available (iOS), otherwise copy to clipboard. */
export async function shareText(text: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Share failed (e.g. not allowed): fall back to clipboard.
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
