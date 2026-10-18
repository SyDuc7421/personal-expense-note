import { BlobError, BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob'
import { strongEtag, type SnapshotStore } from './_handler.js'

async function exists(pathname: string): Promise<boolean> {
  try {
    await head(pathname)
    return true
  } catch (e) {
    if (e instanceof BlobNotFoundError) return false
    throw e
  }
}

/** SnapshotStore on the Vercel Blob private store linked to the project (BLOB_READ_WRITE_TOKEN). */
export function createBlobStore(): SnapshotStore {
  return {
    async read(pathname) {
      const result = await get(pathname, { access: 'private', useCache: false })
      if (!result || result.statusCode !== 200) return null
      return { body: await new Response(result.stream).text(), etag: strongEtag(result.blob.etag) }
    },

    async write(pathname, body, ifMatch) {
      const options = { access: 'private', contentType: 'application/json', addRandomSuffix: false } as const
      if (ifMatch === null) {
        // put has no create-only precondition: check first, and let allowOverwrite: false catch the rare race.
        if (await exists(pathname)) return null
        try {
          return { etag: (await put(pathname, body, { ...options, allowOverwrite: false })).etag }
        } catch (e) {
          // Lost the race to another device creating the same store: report a precondition failure (412), not a 500.
          if (e instanceof BlobError && (await exists(pathname))) return null
          throw e
        }
      }
      try {
        return { etag: (await put(pathname, body, { ...options, ifMatch })).etag }
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) return null
        throw e
      }
    },
  }
}
