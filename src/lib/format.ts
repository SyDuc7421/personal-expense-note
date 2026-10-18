import { format, parseISO } from 'date-fns'

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

export function formatVND(amount: number): string {
  return vnd.format(amount)
}

/** dd/MM */
export function formatShortDate(isoDate: string): string {
  return format(parseISO(isoDate), 'dd/MM')
}

/** Local date as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

/** YYYY-MM */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}
