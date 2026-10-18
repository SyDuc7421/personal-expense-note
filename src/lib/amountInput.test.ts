import { formatAmountInput, parseAmountInput } from './amountInput'

test('parses grouped and plain digits, rejects garbage', () => {
  expect(parseAmountInput('600.000')).toBe(600000)
  expect(parseAmountInput('600 000 ₫')).toBe(600000)
  expect(parseAmountInput('35000')).toBe(35000)
  expect(parseAmountInput('')).toBeNaN()
  expect(parseAmountInput('abc')).toBeNaN()
  expect(parseAmountInput('-5')).toBeNaN()
})

test('a decimal point is not silently dropped', () => {
  expect(parseAmountInput('1.5')).toBeNaN()
  expect(parseAmountInput('1,5')).toBeNaN()
  expect(parseAmountInput('1.50')).toBeNaN()
  expect(parseAmountInput('1,500')).toBe(1500)
  expect(parseAmountInput('1.500.000')).toBe(1500000)
  expect(parseAmountInput('12 500 000')).toBe(12500000)
  expect(parseAmountInput('35000đ')).toBe(35000)
})

test('formatAmountInput groups digits with dots as the user types', () => {
  expect(formatAmountInput('100000')).toBe('100.000')
  expect(formatAmountInput('1500000')).toBe('1.500.000')
  expect(formatAmountInput('999')).toBe('999')
  expect(formatAmountInput('')).toBe('')
  // re-grouping after an edit or a paste
  expect(formatAmountInput('100.00')).toBe('10.000')
  expect(formatAmountInput('1,500 ₫')).toBe('1.500')
  expect(formatAmountInput('007')).toBe('7')
  expect(formatAmountInput('abc')).toBe('')
  // stays parseable
  expect(parseAmountInput(formatAmountInput('12500000'))).toBe(12500000)
})
