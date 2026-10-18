import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { Banner } from '@/components/Banner'
import { useDuplicateFriendsViewModel } from '@/features/shared/viewmodels/useDuplicateFriendsViewModel'
import { useInstallGuideViewModel } from '@/features/shared/viewmodels/useInstallGuideViewModel'
import { BottomTabBar } from './BottomTabBar'
import { useKeyboardOpen } from './useKeyboardOpen'

export function AppLayout() {
  const { t } = useTranslation()
  const keyboardOpen = useKeyboardOpen()
  const install = useInstallGuideViewModel()
  const duplicates = useDuplicateFriendsViewModel()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <h1 className="flex h-12 items-center text-lg font-semibold">{t('app.name')}</h1>
      </header>
      {install.state.visible && (
        <div className="px-4 pt-3">
          <Banner message={t('banners.install')} dismissLabel={t('banners.dismiss')} onDismiss={install.actions.dismiss} />
        </div>
      )}
      {duplicates.state.visible && (
        <div className="px-4 pt-3">
          <Banner
            message={t('banners.duplicateFriends')}
            actionLabel={t('banners.mergeFriends')}
            onAction={() => void duplicates.actions.merge()}
          />
        </div>
      )}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomTabBar hidden={keyboardOpen} />
    </div>
  )
}
