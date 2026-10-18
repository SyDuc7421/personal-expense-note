import { parseAmountInput } from './amountInput'

test('parses grouped and plain digits, rejects garbage', () => {
  expect(parseAmountInput('600.000')).toBe(600000)
  expect(parseAmountInput('600 000 ₫')).toBe(600000)
  expect(parseAmountInput('35000')).toBe(35000)
  expect(parseAmountInput('')).toBeNaN()
  expect(parseAmountInput('abc')).toBeNaN()
  expect(parseAmountInput('-5')).toBeNaN()
})
