import { createDb } from './db'
import { createDexieRepositories } from './repositories/dexie'

/** Fresh in-memory (fake-indexeddb) database + repositories for tests. */
export function createTestRepositories() {
  const db = createDb(`test-${crypto.randomUUID()}`)
  return { db, repos: createDexieRepositories(db) }
}
