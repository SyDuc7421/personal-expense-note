import { expect, test } from '@playwright/test'
import { addFriends, addSplitExpense, expectNoHorizontalScroll, showFriendList } from './helpers/app'
import { expectTouchTargets } from './helpers/touchTargets'

test('split expense creates debts; partial payment; delete removes debts', async ({ page }) => {
  await addFriends(page, ['Nam', 'Huy', 'Linh'])
  await addSplitExpense(page, '600000', 'lẩu', ['Nam', 'Huy', 'Linh'])

  await page.getByRole('link', { name: 'Nợ' }).click()
  await expect(page.getByText('450.000 ₫')).toBeVisible()
  for (const name of ['Nam', 'Huy', 'Linh']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toContainText('150.000 ₫')
  }
  await expectTouchTargets(page)

  // Nam pays back 100k
  await page.getByRole('button', { name: /^Nam/ }).click()
  await page.getByRole('button', { name: 'Đã trả' }).click()
  await expect(page.getByLabel('Số tiền (₫)')).toHaveValue('150.000')
  await page.getByLabel('Số tiền (₫)').fill('100000')
  await expect(page.getByLabel('Số tiền (₫)')).toHaveValue('100.000')
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByText('50.000 ₫').first()).toBeVisible()
  await expectTouchTargets(page)

  // Delete the hotpot: debts disappear, Nam now has a credit (paid 100k for nothing)
  await page.getByRole('link', { name: 'Giao dịch' }).click()
  await page.getByRole('button', { name: /lẩu/ }).click()
  await page.getByRole('button', { name: 'Xóa' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa' }).last().click()
  await expect(page.getByText('Tháng này chưa có giao dịch.')).toBeVisible()
  await page.getByRole('link', { name: 'Nợ' }).click()
  await expect(page.getByRole('button', { name: /^Huy/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Nam/ })).toContainText('-100.000 ₫')
})

test('export, clear all, import restores data', async ({ page }) => {
  await addFriends(page, ['Bình'])
  await addSplitExpense(page, '90000', 'cafe', ['Bình'])
  await page.goto('/settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const file = await (await download).path()
  await expect(page.getByText(/Export lần cuối/)).toBeVisible()

  await page.getByRole('button', { name: 'Xóa toàn bộ dữ liệu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa toàn bộ dữ liệu' }).click()
  await expect(page.getByText('Chưa có bạn nào.')).toBeVisible()

  await page.getByTestId('import-file').setInputFiles(file)
  await page.getByRole('dialog').getByRole('button', { name: 'Import JSON' }).click()
  await showFriendList(page)
  await expect(page.getByText('Bình', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Giao dịch' }).click()
  await expect(page.getByRole('button', { name: /cafe/ })).toContainText('trả hộ Bình')
})

test('every tab fits the viewport and has large touch targets', async ({ page }) => {
  for (const path of ['/', '/transactions', '/debts', '/settings']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expectNoHorizontalScroll(page)
    await expectTouchTargets(page)
  }
})

test('sheet select picks a category and filters the list', async ({ page }) => {
  await addSplitExpense(page, '35000', 'cafe', [])
  await addSplitExpense(page, '50000', 'grab', [])
  await page.getByRole('button', { name: 'Danh mục' }).click()
  await expect(page.getByRole('listbox')).toBeVisible()
  await expectTouchTargets(page)
  await page.getByRole('option', { name: /Di chuyển/ }).click()
  await expect(page.getByRole('button', { name: 'Danh mục' })).toContainText('Di chuyển')
  await expect(page.getByRole('button', { name: /grab/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /cafe/ })).toHaveCount(0)
})

test('transaction form fits the drawer: date input stays in its column, no horizontal scroll', async ({ page }) => {
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Thêm giao dịch' }).click()
  const dialog = page.getByRole('dialog')
  const dialogBox = (await dialog.boundingBox())!
  const dateBox = (await page.getByLabel('Ngày').boundingBox())!
  const categoryBox = (await page.getByRole('button', { name: 'Danh mục' }).boundingBox())!
  expect(dateBox.x + dateBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width)
  expect(Math.abs(dateBox.height - categoryBox.height)).toBeLessThanOrEqual(1)
  const overflow = await dialog.locator('form > div').first().evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(overflow).toBe(0)
})
