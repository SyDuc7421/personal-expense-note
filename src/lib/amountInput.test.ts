import { parseAmountInput } from './amountInput'

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
