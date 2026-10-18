import { nextUpdatedAt } from '@/domain/sync/clock'
import type { Syncable } from '@/domain/types'

export const isAlive = <T extends { deletedAt: string | null }>(item: T | undefined): item is T =>
  item !== undefined && item.deletedAt === null

export function newSyncable(): Syncable {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null }
}

export function touch(record: Syncable): { updatedAt: string } {
  return { updatedAt: nextUpdatedAt(record.updatedAt) }
}

export function tombstone(record: Syncable): { updatedAt: string; deletedAt: string } {
  const updatedAt = nextUpdatedAt(record.updatedAt)
  return { updatedAt, deletedAt: updatedAt }
}

export const byCreated = (a: Syncable, b: Syncable) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
