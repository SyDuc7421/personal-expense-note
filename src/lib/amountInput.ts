/** Parses a typed money amount: accepts "600.000", "600 000", "600000"; NaN when empty or not a number. */
export function parseAmountInput(value: string): number {
  const digits = value.replace(/[.\s,₫đ]/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : NaN
}
