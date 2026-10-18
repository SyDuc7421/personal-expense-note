import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SettingsViewModel } from '../viewmodels/useSettingsViewModel'
import { Section } from './Section'

export function SyncSection({ vm }: { vm: SettingsViewModel }) {
  const { t } = useTranslation()
  const { state, actions } = vm
  const sync = state.sync
  return (
    <Section title={t('settings.sync')}>
      <p className="text-sm text-muted-foreground" role="status">
        {sync.statusLabel}
      </p>
      {sync.code === null ? (
        <>
          <p className="text-sm text-muted-foreground">{t('settings.syncHint')}</p>
          <Button onClick={() => void actions.createCode()} disabled={sync.busy}>
            {t('settings.syncCreate')}
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void actions.joinWithCode()
            }}
          >
            <Input
              aria-label={t('settings.syncJoinLabel')}
              placeholder={t('settings.syncJoinLabel')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={sync.joinDraft}
              onChange={(e) => actions.setJoinDraft(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!sync.joinDraft.trim() || sync.busy}>
              {t('settings.syncJoin')}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm" aria-label={t('settings.syncCodeLabel')}>
              {sync.codeVisible ? sync.code : `••••••••${sync.code.slice(-4)}`}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={sync.codeVisible ? t('settings.syncHideCode') : t('settings.syncShowCode')}
              onClick={actions.toggleCodeVisible}
            >
              {sync.codeVisible ? <EyeOff /> : <Eye />}
            </Button>
            <Button variant="ghost" size="icon" className="size-11" aria-label={t('settings.syncCopyCode')} onClick={() => void actions.copyCode()}>
              <Copy />
            </Button>
          </div>
          <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            {t('settings.syncCodeWarning')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void actions.syncNow()} disabled={sync.busy}>
              <RefreshCw className={sync.busy ? 'animate-spin' : undefined} /> {t('settings.syncNow')}
            </Button>
            <Button variant="outline" onClick={actions.askDisableSync}>
              {t('settings.syncDisable')}
            </Button>
          </div>
        </>
      )}
    </Section>
  )
}
