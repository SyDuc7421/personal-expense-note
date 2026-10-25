import { CATEGORIES, detectCategory } from './categories'
import { normalize } from './text'

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

test('no keyword belongs to two categories', () => {
  const owner = new Map<string, string>()
  for (const c of CATEGORIES) {
    for (const k of c.keywords) {
      const key = normalize(k)
      expect(owner.get(key), `"${k}" in ${c.id} and ${owner.get(key)}`).toBeUndefined()
      owner.set(key, c.id)
    }
  }
})

test.each([
  ['bánh mì sáng', 'anuong'],
  ['highlands', 'anuong'],
  ['đi chợ', 'anuong'],
  ['xe om', 'dichuyen'],
  ['vé máy bay đà nẵng', 'dichuyen'],
  ['thay nhớt', 'dichuyen'],
  ['giày thể thao', 'muasam'],
  ['bách hóa xanh', 'muasam'],
  ['tiền trọ tháng 10', 'hoadon'],
  ['nạp card viettel', 'hoadon'],
  ['vé xem phim cgv', 'giaitri'],
  ['du lịch đà lạt', 'giaitri'],
  ['nha khoa', 'suckhoe'],
  ['học ielts', 'hoctap'],
  ['hoàn tiền shopee', 'muasam'],
])('detects "%s" as %s', (note, id) => {
  expect(detectCategory(note, 'expense')).toBe(id)
})

test('common Vietnamese words do not trigger false matches', () => {
  // "trả" strips to "tra", "miễn" to "mien", "lốp" to "lop": none may hit a category.
  expect(detectCategory('trả nợ', 'expense')).toBe('khac')
  expect(detectCategory('miễn phí', 'expense')).toBe('khac')
  expect(detectCategory('kem chống nắng', 'expense')).toBe('khac')
  expect(detectCategory('hoàn tiền', 'income')).toBe('thunhap')
})
