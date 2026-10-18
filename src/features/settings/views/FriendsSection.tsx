import { Archive, ArchiveRestore, Check, Pencil, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Amount } from '@/components/Amount'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SettingsViewModel } from '../viewmodels/useSettingsViewModel'
import { Section } from './Section'

export function FriendsSection({ vm }: { vm: SettingsViewModel }) {
  const { t } = useTranslation()
  const { state, actions } = vm
  return (
    <Section title={t('settings.friends')}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void actions.addFriend()
        }}
      >
        <Input
          aria-label={t('settings.friendName')}
          placeholder={t('settings.friendName')}
          value={state.newFriendName}
          onChange={(e) => actions.setNewFriendName(e.target.value)}
        />
        <Button type="submit" disabled={!state.newFriendName.trim()}>
          {t('settings.addFriend')}
        </Button>
      </form>
      {state.friends.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{t('settings.noFriends')}</p>
      ) : (
        <ul className="divide-y">
          {state.friends.map((f) =>
            state.editing?.id === f.id ? (
              <li key={f.id} className="flex items-center gap-1 py-1">
                <Input
                  aria-label={t('settings.rename')}
                  autoFocus
                  value={state.editing.name}
                  onChange={(e) => actions.setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void actions.saveEdit()}
                />
                <Button variant="ghost" size="icon" aria-label={t('common.save')} onClick={() => void actions.saveEdit()}>
                  <Check />
                </Button>
                <Button variant="ghost" size="icon" aria-label={t('common.cancel')} onClick={actions.cancelEdit}>
                  <X />
                </Button>
              </li>
            ) : (
              <li key={f.id} className="flex items-center gap-1 py-1">
                <span className={f.archived ? 'min-w-0 flex-1 truncate text-muted-foreground' : 'min-w-0 flex-1 truncate'}>
                  {f.name}
                  {f.archived && <span className="ml-1 text-xs">({t('settings.archived')})</span>}
                </span>
                <Amount label={f.balanceLabel} tone="muted" className="text-sm" />
                <Button variant="ghost" size="icon" aria-label={`${t('settings.rename')} ${f.name}`} onClick={() => actions.startEdit(f.id)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t(f.archived ? 'settings.unarchive' : 'settings.archive')} ${f.name}`}
                  onClick={() => void actions.toggleArchive(f.id)}
                >
                  {f.archived ? <ArchiveRestore /> : <Archive />}
                </Button>
                {f.canDelete && (
                  <Button variant="ghost" size="icon" aria-label={`${t('common.delete')} ${f.name}`} onClick={() => void actions.deleteFriend(f.id)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </Section>
  )
}
