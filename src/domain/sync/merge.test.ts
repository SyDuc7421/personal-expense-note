import fc from 'fast-check'
import type { Friend } from '../types'
import { EMPTY_SNAPSHOT_DATA, merge, mergeRecords, purgeTombstones, type SnapshotData } from './merge'

const friend = (id: string, updatedAt: string, extra: Partial<Friend> = {}): Friend => ({
  id,
  name: id,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
  deletedAt: null,
  ...extra,
})

const T1 = '2026-01-01T00:00:00.000Z'
const T2 = '2026-01-02T00:00:00.000Z'

test('keeps records present on one side only', () => {
  expect(mergeRecords([friend('a', T1)], [friend('b', T1)]).map((f) => f.id)).toEqual(['a', 'b'])
})

test('newer updatedAt wins', () => {
  const older = friend('a', T1, { name: 'old' })
  const newer = friend('a', T2, { name: 'new' })
  expect(mergeRecords([newer], [older])[0].name).toBe('new')
  expect(mergeRecords([older], [newer])[0].name).toBe('new')
})

test('equal updatedAt: deleted wins', () => {
  const live = friend('a', T1)
  const deleted = friend('a', T1, { deletedAt: T1 })
  expect(mergeRecords([live], [deleted])[0].deletedAt).toBe(T1)
  expect(mergeRecords([deleted], [live])[0].deletedAt).toBe(T1)
})

test('equal updatedAt and deletedAt: larger JSON string wins, same result both orders', () => {
  const x = friend('a', T1, { name: 'Huy' })
  const y = friend('a', T1, { name: 'Nam' })
  expect(mergeRecords([x], [y])[0].name).toBe('Nam')
  expect(mergeRecords([y], [x])[0].name).toBe('Nam')
})

test('output sorted by id', () => {
  expect(mergeRecords([friend('c', T1), friend('a', T1)], [friend('b', T1)]).map((f) => f.id)).toEqual(['a', 'b', 'c'])
})

test('merge applies per table', () => {
  const local: SnapshotData = { ...EMPTY_SNAPSHOT_DATA, friends: [friend('a', T2, { name: 'new' })] }
  const remote: SnapshotData = { ...EMPTY_SNAPSHOT_DATA, friends: [friend('a', T1), friend('b', T1)] }
  const merged = merge(local, remote)
  expect(merged.friends.map((f) => f.name)).toEqual(['new', 'b'])
  expect(merged.transactions).toEqual([])
})

const friendArb = fc.record({
  id: fc.constantFrom('a', 'b', 'c', 'd', 'e'),
  name: fc.constantFrom('Nam', 'Huy', 'Linh'),
  archived: fc.boolean(),
  createdAt: fc.constant(T1),
  updatedAt: fc.constantFrom(T1, T2, '2026-01-03T00:00:00.000Z'),
  deletedAt: fc.option(fc.constant(T2), { nil: null }),
})
const sideArb = fc.uniqueArray(friendArb, { selector: (f) => f.id })

test('merge is commutative', () => {
  fc.assert(fc.property(sideArb, sideArb, (a, b) => {
    expect(mergeRecords(a, b)).toEqual(mergeRecords(b, a))
  }))
})

test('merge is idempotent', () => {
  fc.assert(fc.property(sideArb, sideArb, (a, b) => {
    const ab = mergeRecords(a, b)
    expect(mergeRecords(a, ab)).toEqual(ab)
    expect(mergeRecords(ab, ab)).toEqual(ab)
  }))
})

test('merge never loses an id', () => {
  fc.assert(fc.property(sideArb, sideArb, (a, b) => {
    const ids = new Set([...a, ...b].map((f) => f.id))
    expect(new Set(mergeRecords(a, b).map((f) => f.id))).toEqual(ids)
  }))
})

test('purgeTombstones drops tombstones older than 180 days and reports their ids', () => {
  const now = new Date('2026-10-18T00:00:00.000Z')
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
  const data: SnapshotData = {
    ...EMPTY_SNAPSHOT_DATA,
    friends: [
      friend('old', T1, { deletedAt: daysAgo(181) }),
      friend('recent', T1, { deletedAt: daysAgo(179) }),
      friend('live', T1),
    ],
  }
  const { data: kept, purged } = purgeTombstones(data, now)
  expect(kept.friends.map((f) => f.id)).toEqual(['recent', 'live'])
  expect(purged).toEqual({ friends: ['old'], transactions: [], debts: [], settlements: [] })
})
