import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { SettingsViewModel } from '../viewmodels/useSettingsViewModel'
import { Section } from './Section'

const LABELS = { vi: 'Tiếng Việt', en: 'English' } as const

export function LanguageSection({ vm }: { vm: SettingsViewModel }) {
  const { t } = useTranslation()
  return (
    <Section title={t('settings.language')}>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('settings.language')}>
        {vm.state.languages.map((lang) => (
          <Button
            key={lang}
            role="radio"
            aria-checked={vm.state.language === lang}
            variant={vm.state.language === lang ? 'default' : 'outline'}
            onClick={() => void vm.actions.setLanguage(lang)}
          >
            {LABELS[lang]}
          </Button>
        ))}
      </div>
    </Section>
  )
}
