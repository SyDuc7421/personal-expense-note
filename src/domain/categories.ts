import { normalize } from './text'
import type { CategoryId, TransactionType } from './types'

export interface Category {
  id: CategoryId
  icon: string
  keywords: string[]
}

/** Labels live in i18n under `categories.<id>`. */
export const CATEGORIES: Category[] = [
  {
    id: 'anuong',
    icon: '🍜',
    keywords: [
      'cafe', 'cà phê', 'trà sữa', 'cơm', 'phở', 'bún', 'lẩu', 'ăn', 'nhậu',
      'bánh mì', 'bánh cuốn', 'bánh xèo', 'bánh tráng', 'bánh ngọt', 'xôi', 'cháo', 'hủ tiếu', 'mì', 'ốc', 'nướng',
      'gà rán', 'pizza', 'buffet', 'chè', 'trà đá', 'trà chanh', 'nước mía', 'sinh tố', 'bia', 'đồ ăn', 'đi chợ', 'rau',
      'highlands', 'phúc long', 'starbucks', 'kfc', 'lotteria', 'grabfood', 'shopeefood', 'baemin',
    ],
  },
  {
    id: 'dichuyen',
    icon: '🛵',
    keywords: [
      'grab', 'be', 'xăng', 'gửi xe', 'taxi',
      'xe ôm', 'xanh sm', 'gojek', 'xe buýt', 'bus', 'metro', 'giữ xe', 'vé xe', 'vé tàu', 'tàu', 'máy bay', 'vé máy bay',
      'sửa xe', 'rửa xe', 'thay nhớt', 'vá xe', 'phí cầu đường',
    ],
  },
  {
    id: 'muasam',
    icon: '🛍️',
    keywords: [
      'shopee', 'lazada', 'tiki', 'quần', 'áo',
      'tiktok shop', 'giày', 'dép', 'túi xách', 'mỹ phẩm', 'skincare', 'đồng hồ', 'đồ gia dụng', 'quà',
      'siêu thị', 'winmart', 'bách hóa xanh',
    ],
  },
  {
    id: 'hoadon',
    icon: '🧾',
    keywords: [
      'điện', 'nước', 'wifi', 'net', 'tiền nhà', '4g',
      'internet', 'tiền trọ', 'tiền phòng', 'thuê nhà', 'phí chung cư', 'phí quản lý', 'gas',
      'cước điện thoại', 'nạp card', 'viettel', 'vnpt', 'fpt', 'truyền hình', 'icloud',
    ],
  },
  {
    id: 'giaitri',
    icon: '🎮',
    keywords: [
      'phim', 'game', 'netflix', 'spotify', 'karaoke',
      'cgv', 'youtube', 'concert', 'bida', 'bowling', 'đi chơi', 'du lịch', 'khách sạn', 'homestay', 'resort', 'tour', 'vé',
    ],
  },
  {
    id: 'suckhoe',
    icon: '💊',
    keywords: [
      'thuốc', 'khám', 'gym',
      'bệnh viện', 'phòng khám', 'nha khoa', 'răng', 'bác sĩ', 'xét nghiệm', 'tiêm', 'vaccine', 'vitamin', 'yoga',
      'bảo hiểm y tế',
    ],
  },
  {
    id: 'hoctap',
    icon: '📚',
    keywords: [
      'sách', 'khóa học', 'học phí',
      'học', 'gia sư', 'tiếng anh', 'ielts', 'toeic', 'udemy', 'coursera', 'văn phòng phẩm', 'lệ phí thi',
    ],
  },
  {
    id: 'thunhap',
    icon: '💰',
    keywords: ['lương', 'thưởng', 'phụ cấp', 'tiền công', 'hoa hồng', 'freelance', 'cổ tức', 'hoàn tiền', 'cashback'],
  },
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
