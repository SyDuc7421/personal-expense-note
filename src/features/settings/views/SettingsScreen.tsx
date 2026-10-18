import { useTranslation } from 'react-i18next'
import { ConfirmDrawer } from '@/components/ConfirmDrawer'
import { ListSkeleton } from '@/components/ListSkeleton'
import { Button } from '@/components/ui/button'
import { useSettingsViewModel } from '../viewmodels/useSettingsViewModel'
import { BackupSection } from './BackupSection'
import { FriendsSection } from './FriendsSection'
import { LanguageSection } from './LanguageSection'
import { Section } from './Section'

const CONFIRM_COPY = {
  import: { title: 'settings.importConfirmTitle', body: 'settings.importConfirmBody', action: 'settings.import' },
  clear1: { title: 'settings.clearConfirmTitle', body: 'settings.clearConfirmBody', action: 'common.delete' },
  clear2: { title: 'settings.clearConfirmAgainTitle', body: 'settings.clearConfirmAgainBody', action: 'settings.clearAll' },
} as const

export function SettingsScreen() {
  const { t } = useTranslation()
  const vm = useSettingsViewModel()
  const { state, actions } = vm
  const copy = state.confirm ? CONFIRM_COPY[state.confirm] : null

  if (state.isLoading) return <ListSkeleton />

  return (
    <div className="divide-y">
      {state.error && (
        <p role="alert" className="px-4 py-3 text-sm text-destructive">
          {t(state.error)}
        </p>
      )}
      <FriendsSection vm={vm} />
      <BackupSection vm={vm} />
      <LanguageSection vm={vm} />
      <Section title={t('settings.danger')}>
        <Button variant="destructive" onClick={actions.askClear}>
          {t('settings.clearAll')}
        </Button>
      </Section>
      <ConfirmDrawer
        open={copy !== null}
        title={copy ? t(copy.title) : ''}
        description={copy ? t(copy.body) : ''}
        confirmLabel={copy ? t(copy.action) : ''}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void actions.confirm()}
        onCancel={actions.cancelConfirm}
      />
    </div>
  )
}
