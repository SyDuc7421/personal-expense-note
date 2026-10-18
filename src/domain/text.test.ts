import { normalize } from './text'

test('normalize lowercases, strips diacritics and đ', () => {
  expect(normalize('  Đức  Tuấn ')).toBe('duc tuan')
  expect(normalize('CÀ PHÊ')).toBe('ca phe')
})
