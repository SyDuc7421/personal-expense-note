import { useTranslation } from 'react-i18next'
import { useRepositories } from '@/data/RepositoryProvider'
import { useRepoQuery } from './useRepoQuery'

export const REMINDER_TEMPLATE_KEY = 'reminderTemplate'

/** The user's reminder template from meta; empty/unset falls back to the language default. */
export function useReminderTemplate() {
  const { t } = useTranslation()
  const { meta } = useRepositories()
  const saved = useRepoQuery(() => meta.get(REMINDER_TEMPLATE_KEY), [meta])
  return {
    isLoading: saved.isLoading,
    template: saved.data || t('reminder.defaultTemplate'),
  }
}
