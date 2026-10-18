const STALE_DAYS = 14
const MIN_TRANSACTIONS = 10
const DAY_MS = 86_400_000

/** Spec 8 + 9.7: nag to export when the last export is > 14 days old, or never exported with >= 10 transactions; never with sync on. */
export function shouldShowBackupBanner(input: {
  lastExportAt?: string
  transactionCount: number
  syncEnabled: boolean
  now: Date
}): boolean {
  if (input.syncEnabled) return false
  if (!input.lastExportAt) return input.transactionCount >= MIN_TRANSACTIONS
  return input.now.getTime() - new Date(input.lastExportAt).getTime() > STALE_DAYS * DAY_MS
}
