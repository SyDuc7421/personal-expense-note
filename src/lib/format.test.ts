import { formatShortDate, formatVND, monthOf, todayISO } from './format'

test('formatVND uses vi-VN grouping and ₫', () => {
  const s = formatVND(12500000)
  expect(s).toContain('12.500.000')
  expect(s).toContain('₫')
  expect(formatVND(35000).replace(/\s/g, ' ')).toBe('35.000 ₫')
})

test('date helpers', () => {
  expect(formatShortDate('2026-10-05')).toBe('05/10')
  expect(todayISO(new Date(2026, 0, 3, 23, 59))).toBe('2026-01-03')
  expect(monthOf('2026-10-05')).toBe('2026-10')
})
