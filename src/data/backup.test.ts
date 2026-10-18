import { createTestRepositories } from '@/data/testing'
import type { DomainError } from '@/domain/errors'

async function seeded() {
  const t = createTestRepositories()
  const nam = await t.repos.friends.create('Nam')
  const tx = await t.repos.transactions.create({
    type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-10-12',
    splits: [{ friendId: nam, amount: 150000 }],
  })
  await t.repos.ledger.addSettlement({ friendId: nam, amount: 100000, date: '2026-10-13', note: '' })
  const deleted = await t.repos.transactions.create({ type: 'income', amount: 1000, category: 'khac', note: 'x', date: '2026-10-01', splits: [] })
  await t.repos.transactions.remove(deleted)
  return { ...t, nam, tx }
}

test('export -> clearAll -> import restores identical data, including tombstones', async () => {
  const { db, repos } = await seeded()
  const before = {
    friends: await db.friends.toArray(), transactions: await db.transactions.toArray(),
    debts: await db.debts.toArray(), settlements: await db.settlements.toArray(),
  }
  const snapshot = await repos.backup.exportSnapshot()
  expect(snapshot.format).toBe('personal-expense-note-snapshot')
  expect(snapshot.schemaVersion).toBe(1)
  expect(snapshot.transactions).toHaveLength(2)

  await repos.backup.clearAll()
  expect(await db.transactions.count()).toBe(0)

  await repos.backup.importSnapshot(JSON.parse(JSON.stringify(snapshot)))
  expect(await db.friends.toArray()).toEqual(before.friends)
  expect(await db.transactions.toArray()).toEqual(before.transactions)
  expect(await db.debts.toArray()).toEqual(before.debts)
  expect(await db.settlements.toArray()).toEqual(before.settlements)
})

test('clearAll removes lastExportAt but keeps other meta', async () => {
  const { repos } = await seeded()
  await repos.meta.set('lastExportAt', '2026-10-01T00:00:00.000Z')
  await repos.meta.set('language', 'en')
  await repos.backup.clearAll()
  expect(await repos.meta.get('lastExportAt')).toBeUndefined()
  expect(await repos.meta.get('language')).toBe('en')
})

test('invalid import keeps data', async () => {
  const { db, repos } = await seeded()
  const code = async (json: unknown) => repos.backup.importSnapshot(json).then(() => 'ok', (e: DomainError) => e.code)
  expect(await code({ format: 'other' })).toBe('invalidBackup')
  expect(await code('garbage')).toBe('invalidBackup')
  const snapshot = await repos.backup.exportSnapshot()
  expect(await code({ ...snapshot, transactions: [{ id: 'x' }] })).toBe('invalidBackup')
  expect(await code({ ...snapshot, schemaVersion: 99 })).toBe('newerSchema')
  expect(await code({ ...snapshot, friends: [...snapshot.friends, snapshot.friends[0]] })).toBe('invalidBackup')
  expect(await db.transactions.count()).toBe(2)
})
