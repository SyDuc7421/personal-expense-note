import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { downloadJson } from '@/lib/download'
import { todayISO } from '@/lib/format'

export const LAST_EXPORT_KEY = 'lastExportAt'

/** Downloads personal-expense-note-backup-YYYY-MM-DD.json and records meta.lastExportAt. Throws on failure. */
export function useExportBackup() {
  const { t } = useTranslation()
  const { backup, meta } = useRepositories()
  return async function exportBackup() {
    const snapshot = await backup.exportSnapshot()
    downloadJson(`personal-expense-note-backup-${todayISO()}.json`, snapshot)
    await meta.set(LAST_EXPORT_KEY, new Date().toISOString())
    toast.success(t('settings.exported'))
  }
}
