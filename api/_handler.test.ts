// @vitest-environment node
import { handleSnapshot, MAX_SNAPSHOT_BYTES, snapshotPathname, strongEtag, type SnapshotStore } from './_handler.js'

const A = 'a'.repeat(43)
const B = 'b'.repeat(43)
const URL = 'https://app.test/api/snapshot'

function memoryStore(): SnapshotStore {
  const blobs = new Map<string, { body: string; etag: string }>()
  let n = 0
  return {
    async read(pathname) {
      return blobs.get(pathname) ?? null
    },
    async write(pathname, body, ifMatch) {
      const current = blobs.get(pathname)
      if (ifMatch === null ? current : current?.etag !== ifMatch) return null
      const etag = `"${++n}"`
      blobs.set(pathname, { body, etag })
      return { etag }
    },
  }
}

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  format: 'personal-expense-note-snapshot',
  schemaVersion: 1,
  updatedAt: '2026-10-18T00:00:00.000Z',
  updatedBy: 'device',
  friends: [],
  transactions: [],
  debts: [],
  settlements: [],
  ...overrides,
})

const get = (secret?: string) =>
  new Request(URL, { headers: secret ? { authorization: `Bearer ${secret}` } : {} })

const put = (secret: string, body: unknown, headers: Record<string, string>) =>
  new Request(URL, {
    method: 'PUT',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

test('401 without Authorization', async () => {
  expect((await handleSnapshot(get(), memoryStore())).status).toBe(401)
})

test('401 for malformed secret', async () => {
  const store = memoryStore()
  expect((await handleSnapshot(get('a'.repeat(42)), store)).status).toBe(401)
  expect((await handleSnapshot(get(`${'a'.repeat(42)}+`), store)).status).toBe(401)
})

test('snapshotPathname is snapshots/<64 hex>.json and stable', () => {
  expect(snapshotPathname(A)).toMatch(/^snapshots\/[0-9a-f]{64}\.json$/)
  expect(snapshotPathname(A)).toBe(snapshotPathname(A))
  expect(snapshotPathname(A)).not.toBe(snapshotPathname(B))
})

test('GET 404 when no snapshot', async () => {
  expect((await handleSnapshot(get(A), memoryStore())).status).toBe(404)
})

test('GET 200 returns body and ETag, never cached', async () => {
  const store = memoryStore()
  const created = await handleSnapshot(put(A, snapshot(), { 'if-none-match': '*' }), store)
  const res = await handleSnapshot(get(A), store)
  expect(res.status).toBe(200)
  expect(res.headers.get('etag')).toBe(created.headers.get('etag'))
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(await res.json()).toEqual(snapshot())
})

test('two secrets read and write separate snapshots', async () => {
  const store = memoryStore()
  await handleSnapshot(put(A, snapshot(), { 'if-none-match': '*' }), store)
  expect((await handleSnapshot(get(B), store)).status).toBe(404)
})

test('PUT with If-None-Match * creates; second create returns 412', async () => {
  const store = memoryStore()
  const first = await handleSnapshot(put(A, snapshot(), { 'if-none-match': '*' }), store)
  expect(first.status).toBe(200)
  expect(first.headers.get('etag')).toBeTruthy()
  expect((await handleSnapshot(put(A, snapshot(), { 'if-none-match': '*' }), store)).status).toBe(412)
})

test('PUT with stale If-Match returns 412; with current etag returns 200 and a new ETag', async () => {
  const store = memoryStore()
  const etag = (await handleSnapshot(put(A, snapshot(), { 'if-none-match': '*' }), store)).headers.get('etag')!
  const ok = await handleSnapshot(put(A, snapshot({ updatedBy: 'x' }), { 'if-match': etag }), store)
  expect(ok.status).toBe(200)
  expect(ok.headers.get('etag')).not.toBe(etag)
  expect((await handleSnapshot(put(A, snapshot(), { 'if-match': etag }), store)).status).toBe(412)
})

test('PUT without If-Match or If-None-Match returns 428', async () => {
  expect((await handleSnapshot(put(A, snapshot(), {}), memoryStore())).status).toBe(428)
})

test('PUT invalid snapshot returns 400', async () => {
  const store = memoryStore()
  expect((await handleSnapshot(put(A, { nope: true }, { 'if-none-match': '*' }), store)).status).toBe(400)
  expect((await handleSnapshot(put(A, 'not json', { 'if-none-match': '*' }), store)).status).toBe(400)
})

test('PUT newer schemaVersion returns 400', async () => {
  expect((await handleSnapshot(put(A, snapshot({ schemaVersion: 2 }), { 'if-none-match': '*' }), memoryStore())).status).toBe(400)
})

test('PUT body over 5 MB returns 413', async () => {
  const body = JSON.stringify(snapshot({ updatedBy: 'x'.repeat(MAX_SNAPSHOT_BYTES) }))
  expect((await handleSnapshot(put(A, body, { 'if-none-match': '*' }), memoryStore())).status).toBe(413)
})

test('405 for other methods', async () => {
  const req = new Request(URL, { method: 'DELETE', headers: { authorization: `Bearer ${A}` } })
  expect((await handleSnapshot(req, memoryStore())).status).toBe(405)
})

test('strongEtag drops the weak prefix compression adds', () => {
  expect(strongEtag('W/"abc"')).toBe('"abc"')
  expect(strongEtag('"abc"')).toBe('"abc"')
})

test('PUT accepts a weak If-Match (the CDN weakens ETags when it compresses responses)', async () => {
  const store = memoryStore()
  const etag = (await handleSnapshot(put(A, snapshot(), { 'if-none-match': '*' }), store)).headers.get('etag')!
  expect((await handleSnapshot(put(A, snapshot(), { 'if-match': `W/${etag}` }), store)).status).toBe(200)
})
