// Renders public/favicon.svg into the PNG icons required by the PWA manifest and iOS.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const svg = readFileSync('public/favicon.svg', 'utf8')
const targets = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]
const browser = await chromium.launch()
for (const [file, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: file, omitBackground: true })
  await page.close()
}
await browser.close()
