import { createBrowserRouter } from 'react-router'
import { DebtsScreen } from '@/features/debts/views/DebtsScreen'
import { FriendDetailScreen } from '@/features/debts/views/FriendDetailScreen'
import { OverviewScreen } from '@/features/overview/views/OverviewScreen'
import { QuickInput } from '@/features/quick-input/views/QuickInput'
import { SettingsScreen } from '@/features/settings/views/SettingsScreen'
import { TransactionsScreen } from '@/features/transactions/views/TransactionsScreen'
import { AppLayout } from './AppLayout'

export const routes = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <OverviewScreen quickInput={<QuickInput />} /> },
      { path: 'transactions', element: <TransactionsScreen /> },
      { path: 'debts', element: <DebtsScreen /> },
      { path: 'debts/:friendId', element: <FriendDetailScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
