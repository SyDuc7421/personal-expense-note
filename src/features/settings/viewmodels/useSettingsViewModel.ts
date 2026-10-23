import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { DomainError } from '@/domain/errors'
import { MAX_BACKUP_BYTES, MAX_SNAPSHOT_BYTES } from '@/domain/snapshot'
import type { Language } from '@/domain/types'
import { changeLanguage, LANGUAGES } from '@/i18n'
import { formatVND } from '@/lib/format'
import { errorKey } from '@/features/shared/viewmodels/errors'
import { useBalances } from '@/features/shared/viewmodels/useBalances'
import { LAST_EXPORT_KEY, useExportBackup } from '@/features/shared/viewmodels/useExportBackup'
import { useFriends } from '@/features/shared/viewmodels/useFriends'
import { isIosDevice } from '@/features/shared/viewmodels/useInstallGuideViewModel'
import { REMINDER_TEMPLATE_KEY, useReminderTemplate } from '@/features/shared/viewmodels/useReminderTemplate'
import { useRepoQuery } from '@/features/shared/viewmodels/useRepoQuery'
import { useSyncStatus } from '@/features/shared/viewmodels/useSyncStatus'

export interface FriendRow {
  id: string
  name: string
  archived: boolean
  balanceLabel: string
  canDelete: boolean
}

export type SettingsConfirm = null | 'import' | 'clear1' | 'clear2' | 'disableSync'

export interface SyncSectionState {
  enabled: boolean
  /** The sync code in use, or null when sync is off. */
  code: string | null
  codeVisible: boolean
  joinDraft: string
  statusLabel: string
  /** HH:mm */
  lastSyncLabel: string | null
  busy: boolean
}

export interface SettingsViewModel {
  state: {
    isLoading: boolean
    loadError: boolean
    friends: FriendRow[]
    newFriendName: string
    editing: { id: string; name: string } | null
    /** The friend list is hidden by default so Settings doesn't open on a long list. */
    friendsExpanded: boolean
    /** i18n key */
    error: string | null
    confirm: SettingsConfirm
    lastExportLabel: string | null
    /** iOS deletes a home-screen app's data together with its icon. */
    showIosDataWarning: boolean
    language: Language
    languages: Language[]
    reminderTemplate: string
    sync: SyncSectionState
  }
  actions: {
    setNewFriendName(name: string): void
    toggleFriendsList(): void
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
    setReminderTemplate(template: string): void
    saveReminderTemplate(): Promise<void>
    resetReminderTemplate(): Promise<void>
    createCode(): Promise<void>
    setJoinDraft(code: string): void
    joinWithCode(): Promise<void>
    toggleCodeVisible(): void
    copyCode(): Promise<void>
    askDisableSync(): void
    syncNow(): Promise<void>
  }
}

export function useSettingsViewModel(): SettingsViewModel {
  const { t, i18n } = useTranslation()
  const repos = useRepositories()
  const friends = useFriends()
  const balances = useBalances()
  const exportBackup = useExportBackup()
  const lastExport = useRepoQuery(() => repos.meta.get(LAST_EXPORT_KEY), [repos.meta])
  const [newFriendName, setNewFriendName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [friendsExpanded, setFriendsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<SettingsConfirm>(null)
  const [pendingImport, setPendingImport] = useState<unknown>(null)
  const reminder = useReminderTemplate()
  const [templateDraft, setTemplateDraft] = useState<string | null>(null)
  const sync = useSyncStatus()
  const [joinDraft, setJoinDraft] = useState('')
  const [codeVisible, setCodeVisible] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)

  /** Runs an action; maps failures to `error`. Returns true on success. */
  async function attempt(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn()
      setError(null)
      return true
    } catch (e) {
      const key = errorKey(e)
      setError(key)
      toast.error(t(key))
      return false
    }
  }

  const rows = friends.all.map((f): FriendRow => {
    const ledger = balances.byFriend.get(f.id)
    const balance = ledger?.balance ?? 0
    const hasHistory = Boolean(ledger && (ledger.entries.length > 0 || ledger.settlements.length > 0))
    return { id: f.id, name: f.name, archived: f.archived, balanceLabel: formatVND(balance), canDelete: !hasHistory }
  })

  const lastSyncLabel = sync.lastSyncAt ? format(parseISO(sync.lastSyncAt), 'HH:mm') : null
  const statusLabel = (() => {
    const { status } = sync
    if (!sync.code || status.phase === 'disabled') return t('settings.syncOff')
    if (status.phase === 'syncing') return t('settings.syncSyncing')
    if (status.phase === 'offline') return t('settings.syncOffline')
    if (status.phase === 'error') return t(`settings.syncError.${status.error}`)
    return lastSyncLabel ? t('settings.syncSynced', { time: lastSyncLabel }) : t('settings.syncNever')
  })()

  async function syncAction(fn: () => Promise<unknown>): Promise<boolean> {
    setSyncBusy(true)
    try {
      return await attempt(fn)
    } finally {
      setSyncBusy(false)
    }
  }

  const loadError = friends.error ?? balances.error ?? lastExport.error ?? sync.error
  return {
    state: {
      loadError: Boolean(loadError),
      isLoading:
        !loadError &&
        (friends.isLoading || balances.isLoading || lastExport.isLoading || reminder.isLoading || sync.isLoading),
      friends: rows,
      newFriendName,
      editing,
      friendsExpanded,
      error,
      confirm,
      lastExportLabel: lastExport.data ? format(parseISO(lastExport.data), 'dd/MM/yyyy HH:mm') : null,
      showIosDataWarning: isIosDevice(navigator),
      language: i18n.language === 'en' ? 'en' : 'vi',
      languages: LANGUAGES,
      reminderTemplate: templateDraft ?? reminder.template,
      sync: {
        enabled: sync.code !== null,
        code: sync.code,
        codeVisible,
        joinDraft,
        statusLabel,
        lastSyncLabel,
        busy: syncBusy || sync.status.phase === 'syncing',
      },
    },
    actions: {
      setNewFriendName,
      toggleFriendsList: () => setFriendsExpanded((v) => !v),
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
        await attempt(exportBackup)
      },
      async importJson(file) {
        await attempt(async () => {
          if (file.size > MAX_BACKUP_BYTES) throw new DomainError('backupTooLarge')
          // With sync on the restore is uploaded next, and the server refuses it above this size.
          if (sync.code !== null && file.size > MAX_SNAPSHOT_BYTES) throw new DomainError('backupTooLargeForSync')
          let json: unknown
          try {
            json = JSON.parse(await file.text())
          } catch {
            throw new DomainError('invalidBackup')
          }
          // Validate before asking to overwrite everything.
          repos.backup.validateSnapshot(json)
          setPendingImport(json)
          setConfirm('import')
        })
      },
      askClear: () => setConfirm('clear1'),
      async confirm() {
        if (confirm === 'clear1') return setConfirm('clear2')
        const current = confirm
        setConfirm(null)
        if (current === 'disableSync') {
          await attempt(() => repos.sync.disable())
        } else if (current === 'clear2') {
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
      setReminderTemplate: setTemplateDraft,
      async saveReminderTemplate() {
        const value = templateDraft ?? reminder.template
        if (await attempt(() => repos.meta.set(REMINDER_TEMPLATE_KEY, value))) {
          setTemplateDraft(null)
          toast.success(t('settings.templateSaved'))
        }
      },
      async resetReminderTemplate() {
        if (await attempt(() => repos.meta.set(REMINDER_TEMPLATE_KEY, ''))) setTemplateDraft(null)
      },
      async createCode() {
        await syncAction(() => repos.sync.createSecret())
      },
      setJoinDraft,
      async joinWithCode() {
        if (await syncAction(() => repos.sync.joinWithSecret(joinDraft))) setJoinDraft('')
      },
      toggleCodeVisible: () => setCodeVisible((v) => !v),
      async copyCode() {
        const code = sync.code
        if (code && (await attempt(() => navigator.clipboard.writeText(code)))) toast.success(t('settings.syncCodeCopied'))
      },
      askDisableSync: () => setConfirm('disableSync'),
      async syncNow() {
        await syncAction(() => repos.sync.sync())
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
