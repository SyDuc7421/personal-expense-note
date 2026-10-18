import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { getCategory } from '@/domain/categories'
import { parse } from '@/domain/parser'
import type { CategoryId, TransactionType } from '@/domain/types'
import { formatVND } from '@/lib/format'
import { errorKey } from '@/features/shared/viewmodels/errors'
import { useFriends } from '@/features/shared/viewmodels/useFriends'

export interface QuickInputPreview {
  type: TransactionType
  amountLabel: string
  categoryId: CategoryId
  categoryIcon: string
  note: string
  dateLabel: string
  debtorNames: string[]
  /** Per-friend share; null when nobody is mentioned. */
  eachLabel: string | null
  myShareLabel: string
  newFriendNames: string[]
}

export interface QuickInputViewModel {
  state: {
    isReady: boolean
    text: string
    preview: QuickInputPreview | null
    /** i18n key */
    error: string | null
    isSaving: boolean
  }
  actions: {
    setText(text: string): void
    save(): Promise<void>
  }
}

export function useQuickInputViewModel(opts: { today?: Date } = {}): QuickInputViewModel {
  const { t } = useTranslation()
  const { friends: friendRepo, transactions } = useRepositories()
  const friends = useFriends()
  const [text, setText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const todayKey = (opts.today ?? new Date()).toDateString()

  const result = useMemo(
    () => (text.trim() ? parse(text, friends.all, new Date(todayKey)) : null),
    [text, friends.all, todayKey],
  )

  const preview = useMemo((): QuickInputPreview | null => {
    if (!result?.ok) return null
    const d = parseISO(result.date)
    return {
      type: result.type,
      amountLabel: formatVND(result.amount),
      categoryId: result.category,
      categoryIcon: getCategory(result.category).icon,
      note: result.note,
      dateLabel: isToday(d) ? t('common.today') : isYesterday(d) ? t('common.yesterday') : format(d, 'dd/MM'),
      debtorNames: result.splits.map((s) => s.friendName),
      eachLabel: result.splits.length ? formatVND(result.splits[0].amount) : null,
      myShareLabel: formatVND(result.myShare),
      newFriendNames: result.newFriendNames,
    }
  }, [result, t])

  async function save() {
    if (!result?.ok || isSaving) return
    setIsSaving(true)
    try {
      const splits = []
      for (const s of result.splits) {
        const friendId = s.friendId ?? (await friendRepo.findByName(s.friendName))?.id ?? (await friendRepo.create(s.friendName))
        splits.push({ friendId, amount: s.amount })
      }
      await transactions.create({
        type: result.type,
        amount: result.amount,
        category: result.category,
        note: result.note,
        date: result.date,
        rawInput: text.trim(),
        splits,
      })
      setText('')
      setSaveError(null)
      toast.success(t('overview.saved'))
    } catch (e) {
      setSaveError(errorKey(e))
    } finally {
      setIsSaving(false)
    }
  }

  return {
    state: {
      isReady: !friends.isLoading,
      text,
      preview,
      error: saveError ?? (result && !result.ok ? `parse.${result.code}` : null),
      isSaving,
    },
    actions: {
      setText(value) {
        setText(value)
        setSaveError(null)
      },
      save,
    },
  }
}
