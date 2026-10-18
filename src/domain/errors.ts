export type DomainErrorCode =
  | 'invalidAmount'
  | 'splitsExceedAmount'
  | 'duplicateSplitFriend'
  | 'incomeWithSplits'
  | 'notFound'
  | 'emptyName'
  | 'duplicateName'
  | 'nonZeroBalance'
  | 'friendHasHistory'
  | 'invalidBackup'
  | 'newerSchema'
  | 'invalidDebtSelection'
  | 'syncCodeNotFound'

/** Error with a stable code; the UI translates `code` via i18n `errors.<code>`. */
export class DomainError extends Error {
  readonly code: DomainErrorCode
  constructor(code: DomainErrorCode) {
    super(code)
    this.code = code
  }
}
