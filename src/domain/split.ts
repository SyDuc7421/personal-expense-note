export type SplitErrorCode = 'invalidParts' | 'amountTooSmall'

export class SplitError extends Error {
  readonly code: SplitErrorCode
  constructor(code: SplitErrorCode) {
    super(code)
    this.code = code
  }
}

const ROUND_UNIT = 1000

/**
 * Splits `amount` between me and `friendCount` friends.
 * Each friend's share is rounded down to 1.000 ₫; the rounding remainder is always mine.
 * - default: amount / (friendCount + 1)
 * - parts: amount / parts, parts must be >= friendCount + 1
 * - payForAll: I paid everything for the friends, amount / friendCount
 */
export function computeSplit(
  amount: number,
  friendCount: number,
  opts: { parts?: number; payForAll?: boolean },
): { perFriend: number; myShare: number } {
  let parts: number
  if (opts.payForAll) {
    parts = friendCount
  } else if (opts.parts !== undefined) {
    if (!Number.isInteger(opts.parts) || opts.parts < friendCount + 1) throw new SplitError('invalidParts')
    parts = opts.parts
  } else {
    parts = friendCount + 1
  }
  const perFriend = Math.floor(amount / parts / ROUND_UNIT) * ROUND_UNIT
  if (perFriend <= 0) throw new SplitError('amountTooSmall')
  return { perFriend, myShare: amount - perFriend * friendCount }
}
