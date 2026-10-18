import { detectLanguage } from './index'
import { en } from './locales/en'
import { vi } from './locales/vi'

test('detectLanguage maps vi* to vi, everything else to en', () => {
  expect(detectLanguage('vi-VN')).toBe('vi')
  expect(detectLanguage('en-US')).toBe('en')
  expect(detectLanguage(undefined)).toBe('en')
})

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`)))
}

test('vi and en have the same keys', () => {
  expect(keys(vi).sort()).toEqual(keys(en).sort())
})
