/** 32 random bytes as base64url without padding: 43 chars. Spec 9.4. */
export const SYNC_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function generateSyncSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const isSyncSecret = (s: string) => SYNC_SECRET_PATTERN.test(s)
