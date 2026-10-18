import { createTestRepositories } from '@/data/testing'
import type { DomainError } from '@/domain/errors'
import type { NewTransaction } from '@/domain/types'
import { createMemorySyncApi, type MemorySyncApi } from './memoryApi'

const expense = (note: string, splits: NewTransaction['splits'] = []): NewTransaction => ({
  type: 'expense', amount: 300000, category: 'anuong', note, date: '2026-10-12', splits,
})

function device(api: MemorySyncApi) {
  const net = { online: true }
  const t = createTestRepositories({ syncApi: api, isOnline: () => net.online })
  return { ...t, net }
}

async function balance(repos: ReturnType<typeof device>['repos'], friendId: string) {
  const owed = (await repos.ledger.listDebtEntries(friendId)).reduce((acc, d) => acc + d.amount, 0)
  const paid = (await repos.ledger.listSettlements(friendId)).reduce((acc, s) => acc + s.amount, 0)
  return owed - paid
}

const notes = async (repos: ReturnType<typeof device>['repos']) =>
  (await repos.transactions.listRecent(100)).map((t) => t.note).sort()

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    return (e as DomainError).code
  }
}

function deferred() {
  let release!: () => void
  const promise = new Promise<void>((r) => (release = r))
  return { promise, release }
}

test('disabled without secret; offline when isOnline is false', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  await a.repos.sync.sync()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'disabled' })

  a.net.online = false
  await a.repos.sync.createSecret()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'offline' })
  expect(api.calls).toBe(0)
})

test('createSecret uploads local data to a new store and returns a 43-char code', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  await a.repos.transactions.create(expense('lẩu'))
  const code = await a.repos.sync.createSecret()
  expect(code).toHaveLength(43)
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'idle' })
  expect(api.snapshots.get(code)!.transactions.map((t) => t.note)).toEqual(['lẩu'])
  expect(await a.repos.meta.get('lastSyncAt')).toBeTruthy()
})

test('joinWithSecret with an existing code pulls remote data', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  await a.repos.transactions.create(expense('lẩu'))
  const code = await a.repos.sync.createSecret()
  const b = device(api)
  await b.repos.sync.joinWithSecret(`  ${code}  `)
  expect(await notes(b.repos)).toEqual(['lẩu'])
  expect(await b.repos.meta.get('syncSecret')).toBe(code)
})

test('joinWithSecret with an unknown code throws syncCodeNotFound and saves nothing', async () => {
  const api = createMemorySyncApi()
  const b = device(api)
  await b.repos.transactions.create(expense('cafe'))
  expect(await codeOf(b.repos.sync.joinWithSecret('x'.repeat(43)))).toBe('syncCodeNotFound')
  expect(await codeOf(b.repos.sync.joinWithSecret('too-short'))).toBe('syncCodeNotFound')
  expect(await b.repos.meta.get('syncSecret')).toBeUndefined()
  expect(api.snapshots.size).toBe(0)
  expect(await notes(b.repos)).toEqual(['cafe'])
})

test('acceptance 9: offline writes on two devices end up on both with equal balances', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const nam = await a.repos.friends.create('Nam')
  const code = await a.repos.sync.createSecret()
  const b = device(api)
  await b.repos.sync.joinWithSecret(code)

  a.net.online = false
  b.net.online = false
  for (const note of ['a1', 'a2', 'a3']) await a.repos.transactions.create(expense(note, [{ friendId: nam, amount: 100000 }]))
  for (const note of ['b1', 'b2']) await b.repos.transactions.create(expense(note, [{ friendId: nam, amount: 50000 }]))
  await b.repos.ledger.addSettlement({ friendId: nam, amount: 20000, date: '2026-10-13', note: '' })
  await a.repos.sync.sync()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'offline' })

  a.net.online = true
  b.net.online = true
  await a.repos.sync.sync()
  await b.repos.sync.sync()
  await a.repos.sync.sync()

  expect(await notes(a.repos)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
  expect(await notes(b.repos)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
  expect(await balance(a.repos, nam)).toBe(380000)
  expect(await balance(b.repos, nam)).toBe(380000)
})

test('acceptance 10: delete on A, sync A then B → gone on B', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const id = await a.repos.transactions.create(expense('lẩu'))
  const code = await a.repos.sync.createSecret()
  const b = device(api)
  await b.repos.sync.joinWithSecret(code)

  await a.repos.transactions.remove(id)
  await a.repos.sync.sync()
  await b.repos.sync.sync()
  expect(await notes(b.repos)).toEqual([])
})

test('delete on A vs later edit on B: newer updatedAt wins on both', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const id = await a.repos.transactions.create(expense('lẩu'))
  const code = await a.repos.sync.createSecret()
  const b = device(api)
  await b.repos.sync.joinWithSecret(code)

  await a.repos.transactions.remove(id)
  await new Promise((r) => setTimeout(r, 5))
  await b.repos.transactions.update(id, expense('lẩu nướng'))
  await a.repos.sync.sync()
  await b.repos.sync.sync()
  await a.repos.sync.sync()
  expect(await notes(a.repos)).toEqual(['lẩu nướng'])
  expect(await notes(b.repos)).toEqual(['lẩu nướng'])
})

test('412 once, then the retry succeeds', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const code = await a.repos.sync.createSecret()
  await a.repos.transactions.create(expense('cafe'))
  api.conflictsLeft = 1
  await a.repos.sync.sync()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'idle' })
  expect(api.snapshots.get(code)!.transactions).toHaveLength(1)
})

test('three conflicts in a row → error conflict', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  await a.repos.sync.createSecret()
  api.conflictsLeft = 3
  await a.repos.sync.sync()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'error', error: 'conflict' })
})

test('server 401 → error unauthorized', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  await a.repos.meta.set('syncSecret', 'malformed')
  await a.repos.sync.sync()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'error', error: 'unauthorized' })
})

test('remote schemaVersion 2 → error newerSchema, nothing uploaded', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const code = await a.repos.sync.createSecret()
  api.snapshots.set(code, { ...api.snapshots.get(code)!, schemaVersion: 2 })
  await a.repos.transactions.create(expense('cafe'))
  await a.repos.sync.sync()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'error', error: 'newerSchema' })
  expect(api.snapshots.get(code)!.transactions).toHaveLength(0)
})

test('tombstones older than 180 days are removed locally and from the snapshot', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const id = await a.repos.transactions.create(expense('old'))
  const tx = (await a.db.transactions.get(id))!
  const longAgo = '2025-01-01T00:00:00.000Z'
  await a.db.transactions.put({ ...tx, updatedAt: longAgo, deletedAt: longAgo })
  const code = await a.repos.sync.createSecret()
  expect(await a.db.transactions.get(id)).toBeUndefined()
  expect(api.snapshots.get(code)!.transactions).toHaveLength(0)
})

test('concurrent sync() calls run one at a time and a write made during the upload is pushed after', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const code = await a.repos.sync.createSecret()

  const gate = deferred()
  api.beforePut = () => gate.promise
  const first = a.repos.sync.sync()
  await vi.waitFor(() => expect(api.pendingPuts).toBe(1))
  // Lands after the merge transaction read local data, before the upload finished.
  await a.repos.transactions.create(expense('late'))
  const second = a.repos.sync.sync()
  api.beforePut = undefined
  gate.release()
  await Promise.all([first, second])

  expect(api.maxConcurrent).toBe(1)
  expect(api.snapshots.get(code)!.transactions.map((t) => t.note)).toEqual(['late'])
  expect(await notes(a.repos)).toEqual(['late'])
})

test('hasPendingChanges is false after sync and true after a local write', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  expect(await a.repos.sync.hasPendingChanges()).toBe(false)
  await a.repos.sync.createSecret()
  expect(await a.repos.sync.hasPendingChanges()).toBe(false)
  await new Promise((r) => setTimeout(r, 2))
  await a.repos.transactions.create(expense('cafe'))
  expect(await a.repos.sync.hasPendingChanges()).toBe(true)
  await a.repos.sync.sync()
  expect(await a.repos.sync.hasPendingChanges()).toBe(false)
})

test('disable clears the code and stops syncing', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  await a.repos.sync.createSecret()
  await a.repos.sync.disable()
  expect(await a.repos.meta.get('syncSecret')).toBeUndefined()
  expect(a.repos.sync.getStatus()).toEqual({ phase: 'disabled' })
})

test('subscribe notifies on status change', async () => {
  const api = createMemorySyncApi()
  const a = device(api)
  const seen: string[] = []
  const unsubscribe = a.repos.sync.subscribe(() => seen.push(a.repos.sync.getStatus().phase))
  await a.repos.sync.createSecret()
  unsubscribe()
  await a.repos.sync.sync()
  expect(seen).toEqual(['syncing', 'idle'])
})
