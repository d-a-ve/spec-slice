import type { ExtractResult } from '../../lib/openapi/types'

export type WorkerRequest = {
  id: string
  rawSpec: string
}

export type WorkerResponse =
  | { id: string; ok: true; result: ExtractResult }
  | { id: string; ok: false; error: string }
