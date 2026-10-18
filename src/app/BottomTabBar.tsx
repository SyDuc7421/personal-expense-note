import { Home, Landmark, List, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', key: 'overview', icon: Home, end: true },
  { to: '/transactions', key: 'transactions', icon: List, end: false },
  { to: '/debts', key: 'debts', icon: Landmark, end: false },
  { to: '/settings', key: 'settings', icon: Settings, end: false },
] as const

export function BottomTabBar({ hidden }: { hidden: boolean }) {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('a11y.tabs')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
        hidden && 'hidden',
      )}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ to, key, icon: Icon, end }) => (
          <li key={key}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              <span>{t(`tabs.${key}`)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
