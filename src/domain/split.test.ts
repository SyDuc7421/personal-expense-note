import { computeSplit, SplitError } from './split'

test.each([
  [70000, 1, {}, 35000, 35000],
  [600000, 3, { parts: 4 }, 150000, 150000],
  [600000, 2, { parts: 5 }, 120000, 360000],
  [50000, 1, { payForAll: true }, 50000, 0],
  [50000, 3, { payForAll: true }, 16000, 2000],
  [100000, 2, {}, 33000, 34000],
])('computeSplit(%i, %i, %o)', (amount, count, opts, perFriend, myShare) => {
  expect(computeSplit(amount, count, opts)).toEqual({ perFriend, myShare })
})

test('parts smaller than friends + 1 is invalid', () => {
  expect(() => computeSplit(600000, 2, { parts: 2 })).toThrow(SplitError)
  try {
    computeSplit(600000, 2, { parts: 2 })
  } catch (e) {
    expect((e as SplitError).code).toBe('invalidParts')
  }
})

test('share rounding to zero is amountTooSmall', () => {
  try {
    computeSplit(1500, 1, {})
    throw new Error('should throw')
  } catch (e) {
    expect((e as SplitError).code).toBe('amountTooSmall')
  }
})
