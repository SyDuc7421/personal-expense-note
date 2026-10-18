import { createDb } from './db'
import { createDexieRepositories, type DexieRepositoryOptions } from './repositories/dexie'

/** Fresh in-memory (fake-indexeddb) database + repositories for tests. */
export function createTestRepositories(opts?: DexieRepositoryOptions) {
  const db = createDb(`test-${crypto.randomUUID()}`)
  return { db, repos: createDexieRepositories(db, opts) }
}
