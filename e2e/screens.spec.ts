import { devices, expect, test } from '@playwright/test'
import { addFriends, addSplitExpense } from './helpers/app'

const SIZES = [
  { name: '375', viewport: { width: 375, height: 667 } },
  { name: '430', viewport: devices['iPhone 14 Pro Max'].viewport },
]

test.describe('screenshots', () => {
  for (const size of SIZES) {
    test(`main screens at ${size.name}px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'iphone-13', 'one project is enough')
      await page.setViewportSize(size.viewport)
      await addFriends(page, ['Nam', 'Huy'])
      await addSplitExpense(page, '12500000', 'vé máy bay khứ hồi đi Đà Nẵng cho cả nhóm', ['Nam', 'Huy'])
      for (const [tab, path] of [['overview', '/'], ['transactions', '/transactions'], ['debts', '/debts'], ['settings', '/settings']]) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expect(page.getByRole('navigation')).toBeVisible()
        await page.screenshot({ path: `e2e/__screenshots__/${tab}-${size.name}.png` })
      }
    })
  }
})
