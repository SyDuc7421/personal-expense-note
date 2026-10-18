import { createBlobStore } from './_blobStore.js'
import { handleSnapshot } from './_handler.js'

export function GET(request: Request): Promise<Response> {
  return handleSnapshot(request, createBlobStore())
}

export function PUT(request: Request): Promise<Response> {
  return handleSnapshot(request, createBlobStore())
}
