import { CATEGORIES, detectCategory } from './categories'

test('every preset category exists, khac last', () => {
  expect(CATEGORIES.map((c) => c.id)).toEqual([
    'anuong', 'dichuyen', 'muasam', 'hoadon', 'giaitri', 'suckhoe', 'hoctap', 'thunhap', 'khac',
  ])
})

test('detects category from keywords ignoring case and diacritics', () => {
  expect(detectCategory('Cafe sáng', 'expense')).toBe('anuong')
  expect(detectCategory('ca phe', 'expense')).toBe('anuong')
  expect(detectCategory('GRAB về nhà', 'expense')).toBe('dichuyen')
  expect(detectCategory('đóng tiền nhà', 'expense')).toBe('hoadon')
  expect(detectCategory('khóa học tiếng anh', 'expense')).toBe('hoctap')
})

test('keywords match whole words only', () => {
  // "be" (ride app) must not match inside "bến"
  expect(detectCategory('bến xe', 'expense')).toBe('khac')
  expect(detectCategory('đi be', 'expense')).toBe('dichuyen')
})

test('falls back to khac for expense and thunhap for income', () => {
  expect(detectCategory('linh tinh', 'expense')).toBe('khac')
  expect(detectCategory('bán đồ cũ', 'income')).toBe('thunhap')
  expect(detectCategory('lương', 'income')).toBe('thunhap')
})
