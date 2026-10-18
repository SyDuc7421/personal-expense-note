import { Download, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { SettingsViewModel } from '../viewmodels/useSettingsViewModel'
import { Section } from './Section'

export function BackupSection({ vm }: { vm: SettingsViewModel }) {
  const { t } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)
  const { state, actions } = vm
  return (
    <Section title={t('settings.backup')}>
      <p className="text-sm text-muted-foreground">
        {state.lastExportLabel ? t('settings.lastExport', { date: state.lastExportLabel }) : t('settings.neverExported')}
      </p>
      {state.showIosDataWarning && (
        <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          {t('settings.iosDataWarning')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => void actions.exportJson()}>
          <Download /> {t('settings.export')}
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          <Upload /> {t('settings.import')}
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="import-file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void actions.importJson(file)
        }}
      />
    </Section>
  )
}
