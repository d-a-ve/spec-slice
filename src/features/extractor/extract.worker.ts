import { parseAndExtract } from '../../lib/openapi/parse'
import type { WorkerRequest, WorkerResponse } from './worker-types'

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, rawSpec } = event.data
  try {
    const result = await parseAndExtract(rawSpec)
    const response: WorkerResponse = { id, ok: true, result }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Extract failed',
    }
    self.postMessage(response)
  }
}
