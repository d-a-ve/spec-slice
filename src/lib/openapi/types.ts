export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'head'
  | 'options'
  | 'trace'

export type CopiedRequest = {
  method: string
  url: string
  /** Query parameter examples only. */
  params: Record<string, unknown>
  body: unknown | null
  response: unknown | null
  contentType: string | null
  headers: Record<string, string>
  requiresAuth: boolean
}

export type ExtractedOperation = {
  id: string
  method: string
  path: string
  operationId?: string
  summary?: string
  tags: string[]
  serverUrl: string
  /** Query parameter examples only; path params stay as `{placeholders}` in `url`. */
  params: Record<string, unknown>
  body: unknown | null
  response: unknown | null
  contentType: string | null
  headers: Record<string, string>
  requiresAuth: boolean
}

export type ExtractMeta = {
  title: string
  version?: string
  servers: string[]
}

export type ExtractResult = {
  meta: ExtractMeta
  operations: ExtractedOperation[]
}
