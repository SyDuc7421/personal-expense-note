import { parse, type ParseResult } from './parser'
import type { Friend } from './types'

const today = new Date(2026, 9, 18)
const friend = (name: string, id = name.toLowerCase()): Friend => ({
  id, name, archived: false, createdAt: '', updatedAt: '', deletedAt: null,
})
const friends = [friend('Nam'), friend('Huy'), friend('Linh'), friend('Tuấn', 'tuan'), friend('Anh Tú', 'anhtu')]

function ok(input: string): ParseResult {
  const r = parse(input, friends, today)
  if (!r.ok) throw new Error(`expected ok for "${input}", got ${r.code}`)
  return r
}
const errorOf = (input: string) => {
  const r = parse(input, friends, today)
  return r.ok ? 'ok' : r.code
}

describe('amounts', () => {
  test.each([
    ['cafe 35k', 35000],
    ['cafe 35K', 35000],
    ['x 1.5tr', 1500000],
    ['x 1,5tr', 1500000],
    ['x 1TR', 1000000],
    ['x 2tr5', 2500000],
    ['x 35000', 35000],
    ['x 35.000', 35000],
    ['x 1.250.000', 1250000],
    ['x 35', 35000],
    ['x 2.5k', 2500],
    ['x 1.500', 1500],
    ['x 1.500k', 1500],
    ['x 1,500', 1500],
    ['x 1,250,000', 1250000],
    ['35k', 35000],
  ])('%s → %i', (input, amount) => {
    expect(ok(input).amount).toBe(amount)
  })

  test('no amount, zero, multiple amounts', () => {
    expect(errorOf('cafe sáng')).toBe('noAmount')
    expect(errorOf('cafe 0k')).toBe('zeroAmount')
    expect(errorOf('cafe 35k 20k')).toBe('multipleAmounts')
    expect(errorOf('   ')).toBe('empty')
  })
})

describe('split rules (spec 6.1 table)', () => {
  test('cafe 35k: plain expense', () => {
    const r = ok('cafe 35k')
    expect(r).toMatchObject({ type: 'expense', amount: 35000, note: 'cafe', category: 'anuong', date: '2026-10-18', splits: [], myShare: 35000 })
  })

  test('cafe 70k @Nam: split me + 1', () => {
    const r = ok('cafe 70k @Nam')
    expect(r.splits).toEqual([{ friendName: 'Nam', friendId: 'nam', amount: 35000 }])
    expect(r.myShare).toBe(35000)
    expect(r.note).toBe('cafe')
  })

  test('lẩu 600k /4 @Nam @Huy @Linh', () => {
    const r = ok('lẩu 600k /4 @Nam @Huy @Linh')
    expect(r.splits.map((s) => s.amount)).toEqual([150000, 150000, 150000])
    expect(r.myShare).toBe(150000)
  })

  test('lẩu 600k /5 @Nam @Huy: unmentioned parts are mine', () => {
    const r = ok('lẩu 600k /5 @Nam @Huy')
    expect(r.splits.map((s) => s.amount)).toEqual([120000, 120000])
    expect(r.myShare).toBe(360000)
  })

  test('grab 50k cho @Huy: I pay all for them', () => {
    const r = ok('grab 50k cho @Huy')
    expect(r.splits).toEqual([{ friendName: 'Huy', friendId: 'huy', amount: 50000 }])
    expect(r.myShare).toBe(0)
    expect(r.note).toBe('grab')
    expect(r.category).toBe('dichuyen')
  })

  test('cho with several friends: rounding remainder is mine', () => {
    const r = ok('grab 50k cho @Nam @Huy @Linh')
    expect(r.splits.map((s) => s.amount)).toEqual([16000, 16000, 16000])
    expect(r.myShare).toBe(2000)
  })

  test('"cho" not followed by a mention is part of the note', () => {
    expect(ok('đồ ăn cho mèo 50k').note).toBe('đồ ăn cho mèo')
  })

  test('/N smaller than people is invalid', () => {
    expect(errorOf('lẩu 600k /2 @Nam @Huy')).toBe('invalidParts')
    expect(errorOf('lẩu 600k /0 @Nam')).toBe('invalidParts')
  })

  test('share rounding to zero is amountTooSmall', () => {
    expect(errorOf('kẹo 1500 @Nam')).toBe('amountTooSmall')
  })

  test('/N without mentions is ignored', () => {
    expect(ok('lẩu 600k /4').myShare).toBe(600000)
  })
})

describe('mentions', () => {
  test('case and diacritic insensitive', () => {
    expect(ok('cafe 70k @huy').splits[0]).toMatchObject({ friendId: 'huy', friendName: 'Huy' })
    expect(ok('cafe 70k @tuan').splits[0]).toMatchObject({ friendId: 'tuan', friendName: 'Tuấn' })
    expect(ok('cafe 70k @TUẤN').splits[0].friendId).toBe('tuan')
  })

  test('names with spaces match without spaces', () => {
    expect(ok('cafe 70k @anhtu').splits[0].friendId).toBe('anhtu')
  })

  test('comma-separated mentions without spaces', () => {
    const r = ok('lẩu 600k /4 @Nam,@Huy,@Linh')
    expect(r.splits.map((s) => s.friendName)).toEqual(['Nam', 'Huy', 'Linh'])
    expect(r.myShare).toBe(150000)
  })

  test('duplicate mentions collapse', () => {
    const r = ok('cafe 70k @Nam @nam')
    expect(r.splits).toHaveLength(1)
    expect(r.myShare).toBe(35000)
  })

  test('unknown friends are proposed as new', () => {
    const r = ok('lẩu 600k /4 @Nam @Bình @Minh')
    expect(r.newFriendNames).toEqual(['Bình', 'Minh'])
    expect(r.splits.map((s) => [s.friendName, s.friendId])).toEqual([['Nam', 'nam'], ['Bình', undefined], ['Minh', undefined]])
  })

  test('income cannot have mentions', () => {
    expect(errorOf('+500k @Nam')).toBe('incomeWithMentions')
  })
})

describe('income, category, date', () => {
  test('+500k lương is income in thunhap', () => {
    expect(ok('+500k lương')).toMatchObject({ type: 'income', amount: 500000, note: 'lương', category: 'thunhap', myShare: 500000 })
  })

  test('#category overrides auto-detect; unknown tag is ignored', () => {
    expect(ok('cafe 35k #giaitri').category).toBe('giaitri')
    expect(ok('cafe 35k #xyz').category).toBe('anuong')
    expect(ok('linh tinh 35k').category).toBe('khac')
  })

  test('dates', () => {
    expect(ok('cafe 35k hqua').date).toBe('2026-10-17')
    expect(ok('cafe 35k hôm qua').date).toBe('2026-10-17')
    expect(ok('cafe hôm qua 35k').note).toBe('cafe')
    expect(ok('cafe 35k 12/10').date).toBe('2026-10-12')
    expect(ok('cafe 35k 5/1').date).toBe('2026-01-05')
    expect(errorOf('cafe 35k 31/02')).toBe('invalidDate')
    // A day later than today means last year (e.g. typing 28/12 in January).
    expect(ok('cafe 35k 28/12').date).toBe('2025-12-28')
    expect(ok('cafe 35k 18/10').date).toBe('2026-10-18')
  })

  test('trailing commas are ignored', () => {
    const r = ok('lẩu 600k, /4, @Nam, @Huy, @Linh')
    expect(r.myShare).toBe(150000)
    expect(r.note).toBe('lẩu')
  })
})
