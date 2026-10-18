/**
 * Parses a typed money amount: plain digits, or digits grouped by 3 with ".", "," or spaces
 * ("600.000", "1,500", "12 500 000"). Anything else, including decimals like "1.5", is NaN
 * so it is rejected instead of silently becoming 15.
 */
export function parseAmountInput(value: string): number {
  const v = value.trim().replace(/\s*[₫đ]$/i, '')
  if (/^\d+$/.test(v)) return Number(v)
  if (/^\d{1,3}([.,\s]\d{3})+$/.test(v)) return Number(v.replace(/[.,\s]/g, ''))
  return NaN
}

/** Keeps only digits and groups them by 3 with "." ("100000" -> "100.000"), for amount fields as the user types. */
export function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
