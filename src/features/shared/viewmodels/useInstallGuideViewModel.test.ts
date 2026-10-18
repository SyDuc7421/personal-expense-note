import { isIosDevice, isIosSafariBrowser } from './useInstallGuideViewModel'

const nav = (userAgent: string, extra: object = {}) => ({ userAgent, maxTouchPoints: 5, ...extra }) as unknown as Navigator
const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

test('true only for iOS Safari not in standalone mode', () => {
  expect(isIosSafariBrowser(nav(IOS_SAFARI), false)).toBe(true)
  expect(isIosSafariBrowser(nav(IOS_SAFARI, { standalone: true }), false)).toBe(false)
  expect(isIosSafariBrowser(nav(IOS_SAFARI), true)).toBe(false)
  expect(isIosSafariBrowser(nav(IOS_SAFARI.replace('Safari', 'CriOS/120 Safari')), false)).toBe(false)
  expect(isIosSafariBrowser(nav('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36', { maxTouchPoints: 0 }), false)).toBe(false)
})

test('isIosDevice is true on iOS in any browser or standalone, false elsewhere', () => {
  expect(isIosDevice(nav(IOS_SAFARI))).toBe(true)
  expect(isIosDevice(nav(IOS_SAFARI, { standalone: true }))).toBe(true)
  expect(isIosDevice(nav(IOS_SAFARI.replace('Safari', 'CriOS/120 Safari')))).toBe(true)
  expect(isIosDevice(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'))).toBe(true)
  expect(isIosDevice(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', { maxTouchPoints: 0 }))).toBe(false)
  expect(isIosDevice(nav('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36'))).toBe(false)
})
