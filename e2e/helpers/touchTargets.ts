import { expect, type Page } from '@playwright/test'

/** Every visible button, link and role=button must be at least 44×44 px (Apple HIG). */
export async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a, [role="button"]')]
      .filter((el) => {
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
      .map((el) => {
        const rect = el.getBoundingClientRect()
        return { text: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim(), w: rect.width, h: rect.height }
      })
      .filter((r) => r.w < 44 || r.h < 44),
  )
  expect(small, `touch targets smaller than 44×44: ${JSON.stringify(small)}`).toEqual([])
}
