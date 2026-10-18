import { createHash } from 'node:crypto'
import { SCHEMA_VERSION, snapshotSchema } from '../src/domain/snapshot.js'

export interface SnapshotStore {
  read(pathname: string): Promise<{ body: string; etag: string } | null>
  /** ifMatch null = create only. Returns null when the precondition fails. */
  write(pathname: string, body: string, ifMatch: string | null): Promise<{ etag: string } | null>
}

export const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024
/** 32 random bytes, base64url without padding. Generated on the client. */
export const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** One blob per sync code; the server never stores the code itself. */
export function snapshotPathname(secret: string): string {
  return `snapshots/${createHash('sha256').update(secret).digest('hex')}.json`
}

/** Compressed responses (Blob CDN, Vercel edge) carry weak ETags `W/"…"`; Blob's ifMatch needs the strong form. */
export function strongEtag(etag: string): string {
  return etag.replace(/^W\//, '')
}

function respond(status: number, body?: string, headers: Record<string, string> = {}): Response {
  return new Response(body ?? null, { status, headers: { 'cache-control': 'no-store', ...headers } })
}

function bearer(request: Request): string | null {
  const match = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')
  return match && SECRET_PATTERN.test(match[1]) ? match[1] : null
}

async function handlePut(request: Request, store: SnapshotStore, pathname: string): Promise<Response> {
  const header = request.headers.get('if-match')
  const ifMatch = header && strongEtag(header)
  const createOnly = request.headers.get('if-none-match') === '*'
  if (!ifMatch && !createOnly) return respond(428)

  const body = await request.text()
  if (new TextEncoder().encode(body).length > MAX_SNAPSHOT_BYTES) return respond(413)
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return respond(400)
  }
  const parsed = snapshotSchema.safeParse(json)
  if (!parsed.success || parsed.data.schemaVersion > SCHEMA_VERSION) return respond(400)

  const written = await store.write(pathname, body, createOnly ? null : ifMatch)
  return written ? respond(200, undefined, { etag: written.etag }) : respond(412)
}

/** Spec 9.4. Never logs the secret or the snapshot. */
export async function handleSnapshot(request: Request, store: SnapshotStore): Promise<Response> {
  const secret = bearer(request)
  if (!secret) return respond(401)
  const pathname = snapshotPathname(secret)

  if (request.method === 'GET') {
    const current = await store.read(pathname)
    if (!current) return respond(404)
    return respond(200, current.body, { etag: current.etag, 'content-type': 'application/json' })
  }
  if (request.method === 'PUT') return handlePut(request, store, pathname)
  return respond(405, undefined, { allow: 'GET, PUT' })
}
