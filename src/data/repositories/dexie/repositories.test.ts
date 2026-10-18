import { createTestRepositories } from '@/data/testing'
import type { DomainError } from '@/domain/errors'
import type { NewTransaction } from '@/domain/types'

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    return (e as DomainError).code
  }
}

const lau = (splits: NewTransaction['splits']): NewTransaction => ({
  type: 'expense', amount: 600000, category: 'anuong', note: 'lẩu', date: '2026-10-12', splits,
})

async function setup() {
  const { db, repos } = createTestRepositories()
  const nam = await repos.friends.create('Nam')
  const huy = await repos.friends.create('Huy')
  return { db, repos, nam, huy }
}

describe('transactions', () => {
  test('create stores tx with debts, listByMonth returns them', async () => {
    const { repos, nam, huy } = await setup()
    const id = await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }, { friendId: huy, amount: 150000 }]))
    const list = await repos.transactions.listByMonth('2026-10')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(id)
    expect(list[0].debts.map((d) => d.amount)).toEqual([150000, 150000])
    expect(await repos.transactions.listByMonth('2026-11')).toEqual([])
  })

  test('remove cascades soft delete to debts and hides from reads', async () => {
    const { db, repos, nam } = await setup()
    const id = await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }]))
    await repos.transactions.remove(id)
    expect(await repos.transactions.listByMonth('2026-10')).toEqual([])
    expect(await repos.transactions.get(id)).toBeUndefined()
    expect(await repos.ledger.listDebtEntries(nam)).toEqual([])
    const raw = await db.debts.toArray()
    expect(raw).toHaveLength(1)
    expect(raw[0].deletedAt).not.toBeNull()
    expect(await repos.transactions.count()).toBe(0)
  })

  test('update soft-deletes removed splits, changes amounts, adds new ones', async () => {
    const { db, repos, nam, huy } = await setup()
    const id = await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }]))
    await repos.transactions.update(id, { ...lau([{ friendId: huy, amount: 100000 }]), note: 'lẩu bò' })
    const tx = await repos.transactions.get(id)
    expect(tx?.note).toBe('lẩu bò')
    expect(tx?.debts.map((d) => [d.friendId, d.amount])).toEqual([[huy, 100000]])
    expect(await db.debts.count()).toBe(2)

    await repos.transactions.update(id, lau([{ friendId: huy, amount: 120000 }]))
    const again = await repos.transactions.get(id)
    expect(again?.debts.map((d) => d.amount)).toEqual([120000])
    expect(await db.debts.count()).toBe(2)
  })

  test('update bumps updatedAt monotonically', async () => {
    const { db, repos } = await setup()
    const id = await repos.transactions.create(lau([]))
    await db.transactions.update(id, { updatedAt: '2099-01-01T00:00:00.000Z' })
    await repos.transactions.update(id, lau([]))
    expect((await db.transactions.get(id))?.updatedAt).toBe('2099-01-01T00:00:00.001Z')
  })

  test('rejects splits exceeding amount and invalid amounts', async () => {
    const { repos, nam, huy } = await setup()
    expect(await codeOf(repos.transactions.create({ ...lau([{ friendId: nam, amount: 400000 }, { friendId: huy, amount: 300000 }]) }))).toBe('splitsExceedAmount')
    expect(await codeOf(repos.transactions.create({ ...lau([]), amount: 0 }))).toBe('invalidAmount')
    expect(await codeOf(repos.transactions.create({ ...lau([]), amount: 10.5 }))).toBe('invalidAmount')
    expect(await codeOf(repos.transactions.create(lau([{ friendId: nam, amount: 0 }])))).toBe('invalidAmount')
    expect(await codeOf(repos.transactions.create(lau([{ friendId: nam, amount: 1000 }, { friendId: nam, amount: 1000 }])))).toBe('duplicateSplitFriend')
    expect(await codeOf(repos.transactions.create({ ...lau([{ friendId: nam, amount: 1000 }]), type: 'income' }))).toBe('incomeWithSplits')
    expect(await repos.transactions.count()).toBe(0)
  })

  test('listRecent returns newest first, limited', async () => {
    const { repos } = await setup()
    for (const date of ['2026-10-01', '2026-10-03', '2026-10-02']) await repos.transactions.create({ ...lau([]), date })
    expect((await repos.transactions.listRecent(2)).map((t) => t.date)).toEqual(['2026-10-03', '2026-10-02'])
  })
})

test('createWithFriends creates new friends and the transaction atomically', async () => {
  const { db, repos, nam } = await setup()
  const id = await repos.transactions.createWithFriends({
    ...lau([]),
    splits: [{ friendId: nam, friendName: 'Nam', amount: 150000 }, { friendName: 'Linh', amount: 150000 }],
  })
  expect((await repos.transactions.get(id))?.debts).toHaveLength(2)
  expect((await repos.friends.findByName('linh'))).toBeDefined()

  const before = await db.friends.count()
  expect(await codeOf(repos.transactions.createWithFriends({ ...lau([]), amount: 1000, splits: [{ friendName: 'Minh', amount: 5000 }] }))).toBe('splitsExceedAmount')
  expect(await db.friends.count()).toBe(before)
})

describe('friends', () => {
  test('names are unique ignoring case and diacritics', async () => {
    const { repos, huy } = await setup()
    expect(await codeOf(repos.friends.create('nam'))).toBe('duplicateName')
    expect(await codeOf(repos.friends.create('  '))).toBe('emptyName')
    expect(await codeOf(repos.friends.rename(huy, 'NAM'))).toBe('duplicateName')
    expect(await codeOf(repos.friends.rename(huy, 'nám'))).toBe('duplicateName')
    await repos.friends.rename(huy, 'Huy Trần')
    expect((await repos.friends.findByName('huy tran'))?.id).toBe(huy)
  })

  test('archived friends are hidden by default', async () => {
    const { repos, nam } = await setup()
    await repos.friends.setArchived(nam, true)
    expect((await repos.friends.list()).map((f) => f.name)).toEqual(['Huy'])
    expect(await repos.friends.list({ includeArchived: true })).toHaveLength(2)
  })

  test('cannot remove friend with non-zero balance', async () => {
    const { repos, nam } = await setup()
    await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }]))
    expect(await codeOf(repos.friends.remove(nam))).toBe('nonZeroBalance')
  })

  test('cannot remove a settled friend that still has history (would orphan debts/settlements)', async () => {
    const { repos, nam } = await setup()
    const txId = await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }]))
    await repos.ledger.addSettlement({ friendId: nam, amount: 150000, date: '2026-10-13', note: '' })
    expect(await codeOf(repos.friends.remove(nam))).toBe('friendHasHistory')
    // Deleting the transaction leaves the settlement: still history, still not removable.
    await repos.transactions.remove(txId)
    expect(await codeOf(repos.friends.remove(nam))).toBe('nonZeroBalance')
    expect(await repos.friends.get(nam)).toBeDefined()
  })

  test('deleted friend name can be reused', async () => {
    const { repos, nam } = await setup()
    await repos.friends.remove(nam)
    await expect(repos.friends.create('Nam')).resolves.toBeTypeOf('string')
  })
})

describe('mergeDuplicates', () => {
  async function twoNams() {
    const { db, repos, nam, huy } = await setup()
    // Another device created its own "Nam" offline; it arrived through sync.
    const nam2 = crypto.randomUUID()
    const later = '2099-01-01T00:00:00.000Z'
    await db.friends.add({ id: nam2, name: 'nam', archived: false, createdAt: later, updatedAt: later, deletedAt: null })
    return { db, repos, nam, nam2, huy }
  }

  test('moves debts and settlements to the older friend and removes the newer one', async () => {
    const { repos, nam, nam2 } = await twoNams()
    await repos.transactions.create(lau([{ friendId: nam, amount: 100000 }]))
    await repos.transactions.create(lau([{ friendId: nam2, amount: 200000 }]))
    await repos.ledger.addSettlement({ friendId: nam2, amount: 50000, date: '2026-10-13', note: '' })

    expect(await repos.friends.mergeDuplicates()).toBe(1)

    expect((await repos.friends.list()).filter((f) => f.name.toLowerCase() === 'nam').map((f) => f.id)).toEqual([nam])
    expect((await repos.ledger.listDebtEntries(nam)).map((d) => d.amount).sort()).toEqual([100000, 200000])
    expect((await repos.ledger.listSettlements(nam)).map((s) => s.amount)).toEqual([50000])
    expect(await repos.ledger.listDebtEntries(nam2)).toEqual([])
  })

  test('joins two debts on the same transaction into one, keeping the balance', async () => {
    const { db, repos, nam, nam2, huy } = await twoNams()
    const id = await repos.transactions.create(lau([{ friendId: nam, amount: 100000 }, { friendId: huy, amount: 100000 }]))
    const tx = (await db.transactions.get(id))!
    const now = new Date().toISOString()
    await db.debts.add({ id: crypto.randomUUID(), transactionId: tx.id, friendId: nam2, amount: 50000, createdAt: now, updatedAt: now, deletedAt: null })

    await repos.friends.mergeDuplicates()

    const debts = (await repos.transactions.get(id))!.debts
    expect(debts.filter((d) => d.friendId === nam).map((d) => d.amount)).toEqual([150000])
    expect(new Set(debts.map((d) => d.friendId)).size).toBe(debts.length)
  })

  test('targeted settlements follow a folded debt to the kept debt', async () => {
    const { db, repos, nam, nam2 } = await twoNams()
    const id = await repos.transactions.create(lau([{ friendId: nam, amount: 100000 }]))
    const keptDebt = (await repos.transactions.get(id))!.debts[0].id
    const now = new Date().toISOString()
    const foldedDebt = crypto.randomUUID()
    await db.debts.add({ id: foldedDebt, transactionId: id, friendId: nam2, amount: 50000, createdAt: now, updatedAt: now, deletedAt: null })
    const sid = await repos.ledger.addSettlement({ friendId: nam2, amount: 50000, date: '2026-10-13', note: '', debtIds: [foldedDebt] })

    await repos.friends.mergeDuplicates()

    expect((await db.settlements.get(sid))!.debtIds).toEqual([keptDebt])
  })

  test('returns 0 when there are no duplicates', async () => {
    const { repos } = await setup()
    expect(await repos.friends.mergeDuplicates()).toBe(0)
  })
})

describe('ledger', () => {
  test('debt entries join transaction date and note', async () => {
    const { repos, nam } = await setup()
    const txId = await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }]))
    const entries = await repos.ledger.listDebtEntries(nam)
    expect(entries).toEqual([
      expect.objectContaining({ transactionId: txId, friendId: nam, date: '2026-10-12', note: 'lẩu', amount: 150000 }),
    ])
  })

  test('settlement must be positive integer; removal hides it', async () => {
    const { repos, nam } = await setup()
    expect(await codeOf(repos.ledger.addSettlement({ friendId: nam, amount: 0, date: '2026-10-13', note: '' }))).toBe('invalidAmount')
    const id = await repos.ledger.addSettlement({ friendId: nam, amount: 5000, date: '2026-10-13', note: '' })
    expect(await repos.ledger.listSettlements(nam)).toHaveLength(1)
    await repos.ledger.removeSettlement(id)
    expect(await repos.ledger.listSettlements()).toEqual([])
  })

  test('debts of a deleted transaction are excluded even when the debt itself is live', async () => {
    const { db, repos, nam } = await setup()
    const id = await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }]))
    const tx = (await db.transactions.get(id))!
    // Simulates a merge where the transaction tombstone arrived but the debt tombstone did not.
    await db.transactions.put({ ...tx, deletedAt: '2026-10-13T00:00:00.000Z' })
    expect(await repos.ledger.listDebtEntries()).toEqual([])
  })

  test('targeted settlement stores debtIds', async () => {
    const { repos, nam } = await setup()
    await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }]))
    const [entry] = await repos.ledger.listDebtEntries(nam)
    await repos.ledger.addSettlement({ friendId: nam, amount: 150000, date: '2026-10-13', note: '', debtIds: [entry.debtId] })
    expect((await repos.ledger.listSettlements(nam))[0].debtIds).toEqual([entry.debtId])
  })

  test('amount-only settlement has no debtIds key', async () => {
    const { repos, nam } = await setup()
    await repos.ledger.addSettlement({ friendId: nam, amount: 5000, date: '2026-10-13', note: '' })
    expect('debtIds' in (await repos.ledger.listSettlements(nam))[0]).toBe(false)
  })

  test('rejects bad debtIds', async () => {
    const { repos, nam, huy } = await setup()
    const txId = await repos.transactions.create(lau([{ friendId: nam, amount: 150000 }, { friendId: huy, amount: 150000 }]))
    const namDebt = (await repos.ledger.listDebtEntries(nam))[0].debtId
    const huyDebt = (await repos.ledger.listDebtEntries(huy))[0].debtId
    const add = (debtIds: string[]) => repos.ledger.addSettlement({ friendId: nam, amount: 1000, date: '2026-10-13', note: '', debtIds })
    expect(await codeOf(add([]))).toBe('invalidDebtSelection')
    expect(await codeOf(add([namDebt, namDebt]))).toBe('invalidDebtSelection')
    expect(await codeOf(add([huyDebt]))).toBe('invalidDebtSelection')
    await repos.transactions.remove(txId)
    expect(await codeOf(add([namDebt]))).toBe('invalidDebtSelection')
    expect(await repos.ledger.listSettlements()).toEqual([])
  })
})

test('meta get/set', async () => {
  const { repos } = createTestRepositories()
  expect(await repos.meta.get('x')).toBeUndefined()
  await repos.meta.set('x', '1')
  expect(await repos.meta.get('x')).toBe('1')
})
