import { expect, type Page } from '@playwright/test'

/** The Settings friend list is hidden by default; opens it if it is closed. */
export async function showFriendList(page: Page) {
  const toggle = page.getByRole('button', { name: /^(Hiện|Ẩn) danh sách/ })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
}

export async function addFriends(page: Page, names: string[]) {
  await page.goto('/settings')
  for (const name of names) {
    await page.getByLabel('Tên bạn').fill(name)
    await page.getByRole('button', { name: 'Thêm bạn' }).click()
    await showFriendList(page)
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
}

/** Creates an expense through the manual form, split evenly with the given friends. */
export async function addSplitExpense(page: Page, amount: string, note: string, friends: string[]) {
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Thêm giao dịch' }).click()
  await page.getByLabel('Số tiền (₫)').first().fill(amount)
  await page.getByLabel('Ghi chú').fill(note)
  for (let i = 0; i < friends.length; i++) await page.getByRole('button', { name: 'Thêm bạn' }).click()
  const pickers = page.getByRole('button', { name: 'Chọn bạn' })
  for (const [i, name] of friends.entries()) {
    await pickers.nth(i).click()
    await page.getByRole('option', { name }).click()
    await expect(page.getByRole('listbox')).toBeHidden()
  }
  if (friends.length) await page.getByRole('button', { name: 'Chia đều' }).click()
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

export async function expectNoHorizontalScroll(page: Page) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ])
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}
