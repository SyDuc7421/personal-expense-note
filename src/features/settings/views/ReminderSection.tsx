import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { SettingsViewModel } from '../viewmodels/useSettingsViewModel'
import { Section } from './Section'

export function ReminderSection({ vm }: { vm: SettingsViewModel }) {
  const { t } = useTranslation()
  const { state, actions } = vm
  return (
    <Section title={t('settings.reminderTemplate')}>
      <Textarea
        aria-label={t('settings.reminderTemplate')}
        rows={5}
        value={state.reminderTemplate}
        onChange={(e) => actions.setReminderTemplate(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t('settings.reminderTemplateHint')}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => void actions.resetReminderTemplate()}>
          {t('settings.resetTemplate')}
        </Button>
        <Button onClick={() => void actions.saveReminderTemplate()}>{t('common.save')}</Button>
      </div>
    </Section>
  )
}
