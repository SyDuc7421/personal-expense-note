import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob'
import { strongEtag, type SnapshotStore } from './_handler.js'

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
        try {
          await head(pathname)
          return null
        } catch (e) {
          if (!(e instanceof BlobNotFoundError)) throw e
        }
        return { etag: (await put(pathname, body, { ...options, allowOverwrite: false })).etag }
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
