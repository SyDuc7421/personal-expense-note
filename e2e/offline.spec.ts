import { expect, test } from '@playwright/test'
import { showFriendList } from './helpers/app'

test('app loads offline after the service worker is active', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Personal expense note' })).toBeVisible()
  await page.getByRole('link', { name: 'Cài đặt' }).click()
  await page.getByLabel('Tên bạn').fill('Offline')
  await page.getByRole('button', { name: 'Thêm bạn' }).click()
  await showFriendList(page)
  await expect(page.getByText('Offline', { exact: true })).toBeVisible()
})
