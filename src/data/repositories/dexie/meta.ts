import type { ExpenseNoteDB } from '@/data/db'
import type { MetaRepository } from '../types'

export function createMetaRepository(db: ExpenseNoteDB): MetaRepository {
  return {
    async get(key) {
      return (await db.meta.get(key))?.value
    },
    async set(key, value) {
      await db.meta.put({ key, value })
    },
  }
}
