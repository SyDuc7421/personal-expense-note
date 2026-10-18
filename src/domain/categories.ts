import { normalize } from './text'
import type { CategoryId, TransactionType } from './types'

export interface Category {
  id: CategoryId
  icon: string
  keywords: string[]
}

/** Labels live in i18n under `categories.<id>`. */
export const CATEGORIES: Category[] = [
  { id: 'anuong', icon: '🍜', keywords: ['cafe', 'cà phê', 'trà sữa', 'cơm', 'phở', 'bún', 'lẩu', 'ăn', 'nhậu'] },
  { id: 'dichuyen', icon: '🛵', keywords: ['grab', 'be', 'xăng', 'gửi xe', 'taxi'] },
  { id: 'muasam', icon: '🛍️', keywords: ['shopee', 'lazada', 'tiki', 'quần', 'áo'] },
  { id: 'hoadon', icon: '🧾', keywords: ['điện', 'nước', 'wifi', 'net', 'tiền nhà', '4g'] },
  { id: 'giaitri', icon: '🎮', keywords: ['phim', 'game', 'netflix', 'spotify', 'karaoke'] },
  { id: 'suckhoe', icon: '💊', keywords: ['thuốc', 'khám', 'gym'] },
  { id: 'hoctap', icon: '📚', keywords: ['sách', 'khóa học', 'học phí'] },
  { id: 'thunhap', icon: '💰', keywords: ['lương', 'thưởng'] },
  { id: 'khac', icon: '📦', keywords: [] },
]

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id))

export function isCategoryId(id: string): id is CategoryId {
  return CATEGORY_IDS.has(id)
}

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}

function words(s: string): string {
  return ` ${normalize(s).replace(/[^a-z0-9]+/g, ' ').trim()} `
}

/** Detects a category from whole-word keywords in the note (case/diacritic-insensitive). */
export function detectCategory(note: string, type: TransactionType): CategoryId {
  const haystack = words(note)
  for (const category of CATEGORIES) {
    if (category.keywords.some((k) => haystack.includes(words(k)))) return category.id
  }
  return type === 'income' ? 'thunhap' : 'khac'
}
