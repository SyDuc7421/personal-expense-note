import { z } from 'zod'

export const SNAPSHOT_FORMAT = 'personal-expense-note-snapshot'
export const SCHEMA_VERSION = 1

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const amount = z.number().int().positive()

const syncable = {
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
}

const categoryId = z.enum(['anuong', 'dichuyen', 'muasam', 'hoadon', 'giaitri', 'suckhoe', 'hoctap', 'thunhap', 'khac'])

export const friendSchema = z.object({ ...syncable, name: z.string(), archived: z.boolean() })
export const transactionSchema = z.object({
  ...syncable,
  type: z.enum(['expense', 'income']),
  amount,
  category: categoryId,
  note: z.string(),
  date: isoDate,
  rawInput: z.string().optional(),
})
export const debtSchema = z.object({ ...syncable, transactionId: z.string(), friendId: z.string(), amount })
export const settlementSchema = z.object({
  ...syncable,
  friendId: z.string(),
  amount,
  date: isoDate,
  note: z.string(),
  debtIds: z.array(z.string()).optional(),
})

const uniqueIds = (items: { id: string }[]) => new Set(items.map((i) => i.id)).size === items.length

export const snapshotSchema = z
  .object({
  format: z.literal(SNAPSHOT_FORMAT),
  schemaVersion: z.number().int().positive(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  friends: z.array(friendSchema),
  transactions: z.array(transactionSchema),
  debts: z.array(debtSchema),
  settlements: z.array(settlementSchema),
})
  .refine(
    (s) => uniqueIds(s.friends) && uniqueIds(s.transactions) && uniqueIds(s.debts) && uniqueIds(s.settlements),
    { message: 'duplicate ids' },
  )

export type Snapshot = z.infer<typeof snapshotSchema>
