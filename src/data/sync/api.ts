import type { Snapshot } from '@/domain/snapshot'

export type SyncApiErrorKind = 'unauthorized' | 'network' | 'server'

export class SyncApiError extends Error {
  readonly kind: SyncApiErrorKind
  constructor(kind: SyncApiErrorKind) {
    super(kind)
    this.kind = kind
  }
}

export interface SyncApi {
  get(secret: string): Promise<{ snapshot: unknown; etag: string } | null>
  /** etag null = create only. Returns null on 412. */
  put(secret: string, snapshot: Snapshot, etag: string | null): Promise<{ etag: string } | null>
}

/** Client for api/snapshot.ts (spec 9.4). */
export function createHttpSyncApi(url = '/api/snapshot'): SyncApi {
  async function request(secret: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await fetch(url, { ...init, cache: 'no-store', headers: { ...init.headers, authorization: `Bearer ${secret}` } })
    } catch {
      throw new SyncApiError('network')
    }
    if (res.status === 401) throw new SyncApiError('unauthorized')
    return res
  }

  const etagOf = (res: Response) => {
    const etag = res.headers.get('etag')
    if (!etag) throw new SyncApiError('server')
    return etag
  }

  return {
    async get(secret) {
      const res = await request(secret)
      if (res.status === 404) return null
      if (!res.ok) throw new SyncApiError('server')
      return { snapshot: await res.json(), etag: etagOf(res) }
    },

    async put(secret, snapshot, etag) {
      const res = await request(secret, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...(etag ? { 'if-match': etag } : { 'if-none-match': '*' }) },
        body: JSON.stringify(snapshot),
      })
      if (res.status === 412) return null
      if (!res.ok) throw new SyncApiError('server')
      return { etag: etagOf(res) }
    },
  }
}
