import { DomainError } from '@/domain/errors'

/** Maps any thrown value to an i18n key under `errors.`. */
export function errorKey(error: unknown): string {
  return error instanceof DomainError ? `errors.${error.code}` : 'errors.unknown'
}
