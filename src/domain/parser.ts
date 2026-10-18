import { format, isValid, parse as parseDate, subDays } from 'date-fns'
import { detectCategory, isCategoryId } from './categories'
import { computeSplit, SplitError } from './split'
import { normalize } from './text'
import type { CategoryId, Friend, TransactionType } from './types'

export interface ParsedSplit {
  friendName: string
  /** Undefined when the friend does not exist yet (see newFriendNames). */
  friendId?: string
  amount: number
}

export interface ParseResult {
  ok: true
  type: TransactionType
  amount: number
  note: string
  category: CategoryId
  date: string
  splits: ParsedSplit[]
  myShare: number
  newFriendNames: string[]
}

export type ParseErrorCode =
  | 'empty'
  | 'noAmount'
  | 'zeroAmount'
  | 'multipleAmounts'
  | 'invalidParts'
  | 'amountTooSmall'
  | 'incomeWithMentions'
  | 'invalidDate'

export interface ParseError {
  ok: false
  code: ParseErrorCode
}

const fail = (code: ParseErrorCode): ParseError => ({ ok: false, code })

/** Parses one amount token (already lowercased, without leading "+"); null if it is not an amount. */
function parseAmount(token: string): number | null {
  let m = /^(\d+)tr(\d+)$/.exec(token) // 2tr5 = 2.5tr
  if (m) return Math.round(Number(`${m[1]}.${m[2]}`) * 1_000_000)
  m = /^(\d+(?:[.,]\d+)?)(k|tr)$/.exec(token)
  if (m) return Math.round(Number(m[1].replace(',', '.')) * (m[2] === 'k' ? 1_000 : 1_000_000))
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) return Number(token.replace(/\./g, ''))
  if (/^\d+$/.test(token)) {
    const n = Number(token)
    return n < 1000 ? n * 1000 : n
  }
  return null
}

const mentionKey = (name: string) => normalize(name).replace(/\s/g, '')

/**
 * Quick input syntax: `[+]<amount> | <note> <amount> [/N] [cho] [@friend ...] [#category] [hqua | hôm qua | dd/mm]`.
 * Pure: no I/O; `today` decides the default date.
 */
export function parse(input: string, friends: Friend[], today: Date = new Date()): ParseResult | ParseError {
  const tokens = input
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[,;]+$/, ''))
    .filter(Boolean)
  if (tokens.length === 0) return fail('empty')

  const amounts: number[] = []
  const noteWords: string[] = []
  const mentions: string[] = []
  let type: TransactionType = 'expense'
  let parts: number | undefined
  let payForAll = false
  let category: CategoryId | undefined
  let date = format(today, 'yyyy-MM-dd')

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const lower = token.toLowerCase()
    const key = normalize(token)

    if (token.startsWith('@') && token.length > 1) {
      mentions.push(token.slice(1))
    } else if (token.startsWith('#') && token.length > 1) {
      const tag = key.slice(1)
      if (isCategoryId(tag)) category = tag
    } else if (/^\/\S+$/.test(token)) {
      const n = Number(token.slice(1))
      if (!Number.isInteger(n) || n < 1) return fail('invalidParts')
      parts = n
    } else if (key === 'cho' && tokens[i + 1]?.startsWith('@')) {
      payForAll = true
    } else if (key === 'hqua') {
      date = format(subDays(today, 1), 'yyyy-MM-dd')
    } else if (key === 'hom' && normalize(tokens[i + 1] ?? '') === 'qua') {
      date = format(subDays(today, 1), 'yyyy-MM-dd')
      i++
    } else if (/^\d{1,2}\/\d{1,2}$/.test(token)) {
      const d = parseDate(`${token}/${today.getFullYear()}`, 'd/M/yyyy', today)
      if (!isValid(d)) return fail('invalidDate')
      date = format(d, 'yyyy-MM-dd')
    } else {
      const isIncome = lower.startsWith('+')
      const amount = parseAmount(isIncome ? lower.slice(1) : lower)
      if (amount === null) {
        noteWords.push(token)
      } else {
        amounts.push(amount)
        if (isIncome) type = 'income'
      }
    }
  }

  if (amounts.length === 0) return fail('noAmount')
  if (amounts.length > 1) return fail('multipleAmounts')
  const amount = amounts[0]
  if (amount <= 0) return fail('zeroAmount')

  // Resolve mentions against existing friends, collapsing duplicates.
  const byKey = new Map(friends.map((f) => [mentionKey(f.name), f]))
  const seen = new Set<string>()
  const people: { friendName: string; friendId?: string }[] = []
  for (const name of mentions) {
    const k = mentionKey(name)
    if (seen.has(k)) continue
    seen.add(k)
    const f = byKey.get(k)
    people.push(f ? { friendName: f.name, friendId: f.id } : { friendName: name })
  }
  if (type === 'income' && people.length > 0) return fail('incomeWithMentions')

  let splits: ParsedSplit[] = []
  let myShare = amount
  if (people.length > 0) {
    try {
      const split = computeSplit(amount, people.length, { parts, payForAll })
      splits = people.map((p) => ({ ...p, amount: split.perFriend }))
      myShare = split.myShare
    } catch (e) {
      if (e instanceof SplitError) return fail(e.code)
      throw e
    }
  }

  const note = noteWords.join(' ')
  return {
    ok: true,
    type,
    amount,
    note,
    category: category ?? detectCategory(note, type),
    date,
    splits,
    myShare,
    newFriendNames: people.filter((p) => !p.friendId).map((p) => p.friendName),
  }
}
