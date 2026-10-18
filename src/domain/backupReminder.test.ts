import { shouldShowBackupBanner } from './backupReminder'

const now = new Date('2026-10-18T12:00:00.000Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

test('never exported: show from 10 transactions', () => {
  expect(shouldShowBackupBanner({ transactionCount: 9, syncEnabled: false, now })).toBe(false)
  expect(shouldShowBackupBanner({ transactionCount: 10, syncEnabled: false, now })).toBe(true)
})

test('exported: show when older than 14 days', () => {
  expect(shouldShowBackupBanner({ lastExportAt: daysAgo(14), transactionCount: 50, syncEnabled: false, now })).toBe(false)
  expect(shouldShowBackupBanner({ lastExportAt: daysAgo(15), transactionCount: 1, syncEnabled: false, now })).toBe(true)
})

test('never shown when sync is enabled', () => {
  expect(shouldShowBackupBanner({ lastExportAt: daysAgo(100), transactionCount: 50, syncEnabled: true, now })).toBe(false)
})
