import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { DomainError } from '@/domain/errors'
import type { Language } from '@/domain/types'
import { changeLanguage, LANGUAGES } from '@/i18n'
import { downloadJson } from '@/lib/download'
import { formatVND, todayISO } from '@/lib/format'
import { errorKey } from '@/features/shared/viewmodels/errors'
import { useBalances } from '@/features/shared/viewmodels/useBalances'
import { useFriends } from '@/features/shared/viewmodels/useFriends'
import { useRepoQuery } from '@/features/shared/viewmodels/useRepoQuery'

export interface FriendRow {
  id: string
  name: string
  archived: boolean
  balanceLabel: string
  canDelete: boolean
}

export type SettingsConfirm = null | 'import' | 'clear1' | 'clear2'

export interface SettingsViewModel {
  state: {
    isLoading: boolean
    friends: FriendRow[]
    newFriendName: string
    editing: { id: string; name: string } | null
    /** i18n key */
    error: string | null
    confirm: SettingsConfirm
    lastExportLabel: string | null
    language: Language
    languages: Language[]
  }
  actions: {
    setNewFriendName(name: string): void
    addFriend(): Promise<void>
    startEdit(id: string): void
    setEditName(name: string): void
    saveEdit(): Promise<void>
    cancelEdit(): void
    toggleArchive(id: string): Promise<void>
    deleteFriend(id: string): Promise<void>
    exportJson(): Promise<void>
    importJson(file: File): Promise<void>
    askClear(): void
    confirm(): Promise<void>
    cancelConfirm(): void
    setLanguage(language: Language): Promise<void>
  }
}

export function useSettingsViewModel(): SettingsViewModel {
  const { t, i18n } = useTranslation()
  const repos = useRepositories()
  const friends = useFriends()
  const balances = useBalances()
  const lastExport = useRepoQuery(() => repos.meta.get('lastExportAt'), [repos.meta])
  const [newFriendName, setNewFriendName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<SettingsConfirm>(null)
  const [pendingImport, setPendingImport] = useState<unknown>(null)

  /** Runs an action; maps failures to `error`. Returns true on success. */
  async function attempt(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn()
      setError(null)
      return true
    } catch (e) {
      setError(errorKey(e))
      return false
    }
  }

  const rows = friends.all.map((f): FriendRow => {
    const balance = balances.byFriend.get(f.id)?.balance ?? 0
    return { id: f.id, name: f.name, archived: f.archived, balanceLabel: formatVND(balance), canDelete: balance === 0 }
  })

  return {
    state: {
      isLoading: friends.isLoading || balances.isLoading || lastExport.isLoading,
      friends: rows,
      newFriendName,
      editing,
      error,
      confirm,
      lastExportLabel: lastExport.data ? format(parseISO(lastExport.data), 'dd/MM/yyyy HH:mm') : null,
      language: i18n.language === 'en' ? 'en' : 'vi',
      languages: LANGUAGES,
    },
    actions: {
      setNewFriendName,
      async addFriend() {
        if (await attempt(() => repos.friends.create(newFriendName))) setNewFriendName('')
      },
      startEdit(id) {
        const friend = friends.all.find((f) => f.id === id)
        if (friend) setEditing({ id, name: friend.name })
      },
      setEditName: (name) => setEditing((e) => (e ? { ...e, name } : e)),
      async saveEdit() {
        if (!editing) return
        if (await attempt(() => repos.friends.rename(editing.id, editing.name))) setEditing(null)
      },
      cancelEdit: () => setEditing(null),
      async toggleArchive(id) {
        const friend = friends.all.find((f) => f.id === id)
        if (friend) await attempt(() => repos.friends.setArchived(id, !friend.archived))
      },
      async deleteFriend(id) {
        await attempt(() => repos.friends.remove(id))
      },
      async exportJson() {
        const ok = await attempt(async () => {
          const snapshot = await repos.backup.exportSnapshot()
          downloadJson(`ghi-so-backup-${todayISO()}.json`, snapshot)
          await repos.meta.set('lastExportAt', new Date().toISOString())
        })
        if (ok) toast.success(t('settings.exported'))
      },
      async importJson(file) {
        await attempt(async () => {
          let json: unknown
          try {
            json = JSON.parse(await file.text())
          } catch {
            throw new DomainError('invalidBackup')
          }
          setPendingImport(json)
          setConfirm('import')
        })
      },
      askClear: () => setConfirm('clear1'),
      async confirm() {
        if (confirm === 'clear1') return setConfirm('clear2')
        const current = confirm
        setConfirm(null)
        if (current === 'clear2') {
          if (await attempt(() => repos.backup.clearAll())) toast.success(t('settings.cleared'))
        } else if (current === 'import') {
          const json = pendingImport
          setPendingImport(null)
          if (await attempt(() => repos.backup.importSnapshot(json))) toast.success(t('settings.imported'))
        }
      },
      cancelConfirm() {
        setConfirm(null)
        setPendingImport(null)
      },
      async setLanguage(language) {
        await attempt(async () => {
          await changeLanguage(language)
          await repos.meta.set('language', language)
        })
      },
    },
  }
}
