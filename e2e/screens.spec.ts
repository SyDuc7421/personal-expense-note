import { devices, expect, test } from '@playwright/test'
import { addFriends, addSplitExpense } from './helpers/app'

const SIZES = [
  { name: '375', viewport: { width: 375, height: 667 } },
  { name: '430', viewport: devices['iPhone 14 Pro Max'].viewport },
]

// Visual review snapshots (spec 10.5). Opt-in so normal runs don't rewrite tracked PNGs:
//   pnpm e2e:screenshots
test.describe('screenshots', () => {
  test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to refresh e2e/__screenshots__')

  for (const size of SIZES) {
    test(`main screens at ${size.name}px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'iphone-13', 'one project is enough')
      // Fixed clock so month names and "Today" labels don't change the images.
      await page.clock.setFixedTime(new Date('2026-10-18T10:00:00+07:00'))
      await page.emulateMedia({ reducedMotion: 'reduce' }) // no chart animation mid-capture
      await page.setViewportSize(size.viewport)
      await addFriends(page, ['Nam', 'Huy'])
      await addSplitExpense(page, '12500000', 'vé máy bay khứ hồi đi Đà Nẵng cho cả nhóm', ['Nam', 'Huy'])
      for (const [tab, path] of [['overview', '/'], ['transactions', '/transactions'], ['debts', '/debts'], ['settings', '/settings']]) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expect(page.getByRole('navigation')).toBeVisible()
        await page.screenshot({ path: `e2e/__screenshots__/${tab}-${size.name}.png`, animations: 'disabled' })
      }
    })
  }
})
