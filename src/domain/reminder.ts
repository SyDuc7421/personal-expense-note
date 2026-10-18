export interface ReminderItem {
  /** YYYY-MM-DD */
  date: string
  note: string
  remaining: number
}

const money = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)}đ`
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Fills `{name}`, `{items}` (one "• dd/MM – Note: 150.000đ" line per unpaid debt) and `{total}`. */
export function buildReminder(template: string, name: string, items: ReminderItem[]): string {
  const lines = items.map((i) => {
    const note = i.note.trim()
    return `• ${shortDate(i.date)}${note ? ` – ${capitalize(note)}` : ''}: ${money(i.remaining)}`
  })
  const total = items.reduce((acc, i) => acc + i.remaining, 0)
  return template.replaceAll('{name}', name).replaceAll('{items}', lines.join('\n')).replaceAll('{total}', money(total))
}
