import { isIosSafariBrowser } from './useInstallGuideViewModel'

const nav = (userAgent: string, extra: object = {}) => ({ userAgent, maxTouchPoints: 5, ...extra }) as unknown as Navigator
const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

test('true only for iOS Safari not in standalone mode', () => {
  expect(isIosSafariBrowser(nav(IOS_SAFARI), false)).toBe(true)
  expect(isIosSafariBrowser(nav(IOS_SAFARI, { standalone: true }), false)).toBe(false)
  expect(isIosSafariBrowser(nav(IOS_SAFARI), true)).toBe(false)
  expect(isIosSafariBrowser(nav(IOS_SAFARI.replace('Safari', 'CriOS/120 Safari')), false)).toBe(false)
  expect(isIosSafariBrowser(nav('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36', { maxTouchPoints: 0 }), false)).toBe(false)
})
