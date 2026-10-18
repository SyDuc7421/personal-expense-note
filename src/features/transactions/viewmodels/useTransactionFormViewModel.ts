import { useEffect, useState } from 'react'
import { useRepositories } from '@/data/RepositoryProvider'
import { CATEGORIES, detectCategory } from '@/domain/categories'
import { computeSplit, SplitError } from '@/domain/split'
import type { CategoryId, NewTransaction, TransactionType } from '@/domain/types'
import { formatVND, todayISO } from '@/lib/format'
import { errorKey } from '@/features/shared/viewmodels/errors'
import { useFriends, type FriendOption } from '@/features/shared/viewmodels/useFriends'
import type { CategoryOption } from '@/features/shared/viewmodels/transactionItems'

export interface SplitRow {
  key: string
  friendId: string
  amount: string
}

export interface TransactionFormValues {
  type: TransactionType
  amount: string
  category: CategoryId
  note: string
  date: string
  splits: SplitRow[]
}

/** Values are i18n keys. */
export interface TransactionFormErrors {
  amount?: string
  splits?: string
  form?: string
}

export interface TransactionFormViewModel {
  state: {
    isLoading: boolean
    isEdit: boolean
    values: TransactionFormValues
    errors: TransactionFormErrors
    myShareLabel: string
    isSaving: boolean
    confirmingDelete: boolean
    friends: FriendOption[]
    categories: CategoryOption[]
  }
  actions: {
    setField<K extends Exclude<keyof TransactionFormValues, 'splits'>>(field: K, value: TransactionFormValues[K]): void
    addSplit(): void
    removeSplit(index: number): void
    setSplit(index: number, patch: Partial<Omit<SplitRow, 'key'>>): void
    splitEvenly(): void
    save(): Promise<void>
    askDelete(): void
    cancelDelete(): void
    confirmDelete(): Promise<void>
  }
}

/** Accepts "600.000", "600 000", "600000"; returns NaN when empty or not a number. */
export function parseAmountInput(value: string): number {
  const digits = value.replace(/[.\s,₫đ]/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : NaN
}

const emptyValues = (): TransactionFormValues => ({
  type: 'expense',
  amount: '',
  category: 'khac',
  note: '',
  date: todayISO(),
  splits: [],
})

export function useTransactionFormViewModel({ id, onDone }: { id?: string; onDone: () => void }): TransactionFormViewModel {
  const { transactions } = useRepositories()
  const friends = useFriends()
  const [values, setValues] = useState<TransactionFormValues>(emptyValues)
  const [categoryTouched, setCategoryTouched] = useState(Boolean(id))
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [errors, setErrors] = useState<TransactionFormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    transactions.get(id).then(
      (tx) => {
        if (cancelled) return
        if (tx) {
          setValues({
            type: tx.type,
            amount: String(tx.amount),
            category: tx.category,
            note: tx.note,
            date: tx.date,
            splits: tx.debts.map((d) => ({ key: d.id, friendId: d.friendId, amount: String(d.amount) })),
          })
        } else {
          setErrors({ form: 'errors.notFound' })
        }
        setIsLoading(false)
      },
      (e) => {
        if (cancelled) return
        setErrors({ form: errorKey(e) })
        setIsLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [id, transactions])

  const amount = parseAmountInput(values.amount)
  const owed = values.splits.reduce((acc, s) => acc + (parseAmountInput(s.amount) || 0), 0)
  const myShare = (Number.isNaN(amount) ? 0 : amount) - owed

  const updateSplits = (fn: (splits: SplitRow[]) => SplitRow[]) => setValues((v) => ({ ...v, splits: fn(v.splits) }))

  async function save() {
    const nextErrors: TransactionFormErrors = {}
    if (!(amount > 0)) nextErrors.amount = 'errors.invalidAmount'
    if (values.splits.some((s) => !s.friendId)) nextErrors.splits = 'errors.splitFriendRequired'
    else if (values.splits.some((s) => !(parseAmountInput(s.amount) > 0))) nextErrors.splits = 'errors.invalidAmount'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const input: NewTransaction = {
      type: values.type,
      amount,
      category: values.category,
      note: values.note,
      date: values.date,
      splits: values.type === 'income' ? [] : values.splits.map((s) => ({ friendId: s.friendId, amount: parseAmountInput(s.amount) })),
    }
    setIsSaving(true)
    try {
      if (id) await transactions.update(id, input)
      else await transactions.create(input)
      onDone()
    } catch (e) {
      setErrors({ form: errorKey(e) })
    } finally {
      setIsSaving(false)
    }
  }

  return {
    state: {
      isLoading: isLoading || friends.isLoading,
      isEdit: Boolean(id),
      values,
      errors,
      myShareLabel: formatVND(myShare),
      isSaving,
      confirmingDelete,
      friends: friends.options,
      categories: CATEGORIES.map((c) => ({ id: c.id, icon: c.icon })),
    },
    actions: {
      setField(field, value) {
        setValues((v) => {
          const next = { ...v, [field]: value }
          if (field === 'type' && value === 'income') next.splits = []
          if (!categoryTouched && (field === 'note' || field === 'type')) next.category = detectCategory(next.note, next.type)
          return next
        })
        if (field === 'category') setCategoryTouched(true)
      },
      addSplit: () => updateSplits((s) => [...s, { key: crypto.randomUUID(), friendId: '', amount: '' }]),
      removeSplit: (index) => updateSplits((s) => s.filter((_, i) => i !== index)),
      setSplit: (index, patch) => updateSplits((s) => s.map((row, i) => (i === index ? { ...row, ...patch } : row))),
      splitEvenly() {
        if (!(amount > 0) || values.splits.length === 0) return
        try {
          const { perFriend } = computeSplit(amount, values.splits.length, {})
          updateSplits((s) => s.map((row) => ({ ...row, amount: String(perFriend) })))
          setErrors((e) => ({ ...e, splits: undefined }))
        } catch (e) {
          if (e instanceof SplitError) setErrors((prev) => ({ ...prev, splits: `parse.${e.code}` }))
          else throw e
        }
      },
      save,
      askDelete: () => setConfirmingDelete(true),
      cancelDelete: () => setConfirmingDelete(false),
      async confirmDelete() {
        if (!id) return
        setConfirmingDelete(false)
        try {
          await transactions.remove(id)
          onDone()
        } catch (e) {
          setErrors({ form: errorKey(e) })
        }
      },
    },
  }
}
