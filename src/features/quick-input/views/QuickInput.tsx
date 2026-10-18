import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuickInputViewModel } from '../viewmodels/useQuickInputViewModel'
import { ParsePreview } from './ParsePreview'

export function QuickInput() {
  const { t } = useTranslation()
  const { state, actions } = useQuickInputViewModel()

  return (
    <form
      className="sticky top-[calc(3rem+1px+env(safe-area-inset-top))] z-20 flex flex-col gap-2 border-b bg-background px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault()
        void actions.save()
      }}
    >
      <div className="flex gap-2">
        <Input
          aria-label={t('overview.quickInputLabel')}
          placeholder={t('overview.quickInputPlaceholder')}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          value={state.text}
          onChange={(e) => actions.setText(e.target.value)}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest' })}
        />
        <Button type="submit" disabled={!state.preview || state.isSaving}>
          {t('common.save')}
        </Button>
      </div>
      {state.preview && <ParsePreview preview={state.preview} />}
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {t(state.error)}
        </p>
      )}
    </form>
  )
}
