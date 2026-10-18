import { generateSyncSecret, isSyncSecret } from './secret'

test('generates 43-char base64url codes that differ', () => {
  const a = generateSyncSecret()
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(isSyncSecret(a)).toBe(true)
  expect(generateSyncSecret()).not.toBe(a)
})

test('isSyncSecret rejects other shapes', () => {
  expect(isSyncSecret('a'.repeat(42))).toBe(false)
  expect(isSyncSecret(`${'a'.repeat(42)}+`)).toBe(false)
})
