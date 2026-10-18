import { nextUpdatedAt } from './clock'

test('uses now when previous is older', () => {
  expect(nextUpdatedAt('2020-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z')
})

test('bumps 1ms past previous when clock is behind', () => {
  expect(nextUpdatedAt('2030-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:00.000Z'))).toBe('2030-01-01T00:00:00.001Z')
})

test('without previous returns now', () => {
  expect(nextUpdatedAt(undefined, new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z')
})
