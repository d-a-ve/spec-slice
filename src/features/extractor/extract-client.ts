import type { ExtractResult } from '../../lib/openapi/types'
import type { WorkerRequest, WorkerResponse } from './worker-types'

type Pending = {
  resolve: (result: ExtractResult) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
const pending = new Map<string, Pending>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./extract.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      if (message.ok) entry.resolve(message.result)
      else entry.reject(new Error(message.error))
    }
    worker.onerror = (event) => {
      for (const [, entry] of pending) {
        entry.reject(new Error(event.message || 'Worker failed'))
      }
      pending.clear()
    }
  }
  return worker
}

function requestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function extractInWorker(rawSpec: string): Promise<ExtractResult> {
  const id = requestId()
  const w = getWorker()
  return new Promise<ExtractResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const message: WorkerRequest = { id, rawSpec }
    w.postMessage(message)
  })
}
