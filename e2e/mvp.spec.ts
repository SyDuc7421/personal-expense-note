import { expect, test } from '@playwright/test'
import { addFriends, addSplitExpense, expectNoHorizontalScroll } from './helpers/app'
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
  await expect(page.getByLabel('Số tiền (₫)')).toHaveValue('150000')
  await page.getByLabel('Số tiền (₫)').fill('100000')
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
