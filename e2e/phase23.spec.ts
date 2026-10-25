import { expect, test } from '@playwright/test'
import { expectTouchTargets } from './helpers/touchTargets'

test('quick input split: month spend +150k, three friends owe 150k each', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('Nhập nhanh')
  await input.fill('lẩu 600k /4 @Nam @Huy @Linh')
  await expect(page.getByTestId('parse-preview')).toContainText('Nam, Huy, Linh nợ 150.000 ₫ mỗi người')
  await expect(page.getByTestId('parse-preview')).toContainText('Tạo bạn mới')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  await expect(page.getByText('Chi tháng này').locator('..')).toContainText('150.000 ₫')
  await expect(page.getByText('Ăn uống').last()).toBeVisible()
  await expectTouchTargets(page)

  await page.getByRole('button', { name: /Bạn bè đang nợ bạn/ }).click()
  await expect(page).toHaveURL(/\/debts$/)
  for (const name of ['Nam', 'Huy', 'Linh']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toContainText('150.000 ₫')
  }
})

test('parse error is shown and save is disabled', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Nhập nhanh').fill('cafe 35k 20k')
  await expect(page.getByRole('alert')).toHaveText('Có nhiều số tiền — chỉ giữ một')
  await expect(page.getByRole('button', { name: 'Lưu' })).toBeDisabled()
})

test('remind copies the reminder text when Web Share is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (text: string) => void ((window as unknown as { copied: string }).copied = text) },
      configurable: true,
    })
  })
  await page.goto('/')
  await page.getByLabel('Nhập nhanh').fill('lẩu 600k /4 @Nam @Huy @Linh')
  await page.getByLabel('Nhập nhanh').press('Enter')
  await expect(page.getByLabel('Nhập nhanh')).toHaveValue('')
  await page.goto('/debts')
  await page.getByRole('button', { name: /^Nam/ }).click()
  await page.getByRole('button', { name: 'Nhắc' }).click()
  await expect(page.getByText('Đã copy tin nhắn nhắc nợ')).toBeVisible()
  const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied)
  expect(copied).toMatch(/^Ê Nam, tổng kết tí nha 😄\n• \d{2}\/\d{2} – Lẩu: 150\.000đ\nTổng: 150\.000đ\. Rảnh thì chuyển mình nha!$/)
})

test('switching language to English changes the UI', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(page.getByRole('link', { name: 'Debts' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
})

test('select one debt, mark it paid, undo', async ({ page }) => {
  await page.goto('/')
  for (const input of ['cafe 32k /2 @Nam', 'taxi 70k /2 @Nam']) {
    await page.getByLabel('Nhập nhanh').fill(input)
    await page.getByLabel('Nhập nhanh').press('Enter')
    await expect(page.getByLabel('Nhập nhanh')).toHaveValue('')
  }
  await page.goto('/debts')
  await page.getByRole('button', { name: /^Nam/ }).click()
  await expect(page.getByText('51.000 ₫').first()).toBeVisible()

  await page.getByRole('button', { name: 'Chọn', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Chọn cafe' }).click()
  await expectTouchTargets(page)
  await page.getByRole('button', { name: 'Đã trả (1)' }).click()

  await expect(page.getByText('Đã đánh dấu 1 khoản đã trả')).toBeVisible()
  await expect(page.getByText('35.000 ₫').first()).toBeVisible()
  await expect(page.getByText('Trả: cafe')).toBeVisible()
  await expect(page.getByText('đã trả', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Hoàn tác' }).click()
  await expect(page.getByText('51.000 ₫').first()).toBeVisible()
  await expect(page.getByText('Trả: cafe')).toHaveCount(0)
})
