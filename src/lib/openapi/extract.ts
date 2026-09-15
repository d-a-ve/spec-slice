import { pickMediaExample } from './example-from-schema'
import type {
  CopiedRequest,
  ExtractMeta,
  ExtractResult,
  ExtractedOperation,
  HttpMethod,
} from './types'
import { joinServerAndPath, resolveAgainstDocumentBase, resolveServerUrl, swagger2BaseUrl } from './url'

const METHODS: HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
]

type AnyRecord = Record<string, unknown>

function asRecord(value: unknown): AnyRecord | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as AnyRecord
  }
  return undefined
}

function preferContentType(
  content: Record<string, unknown> | undefined,
): string | null {
  if (!content) return null
  const keys = Object.keys(content)
  if (keys.length === 0) return null
  const preferred = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ]
  for (const type of preferred) {
    if (keys.includes(type)) return type
  }
  return keys[0] ?? null
}

function parameterExample(param: AnyRecord): unknown {
  if (param.example !== undefined) return param.example
  if (param.examples) {
    const examples = asRecord(param.examples)
    const first = examples ? Object.values(examples)[0] : undefined
    const firstRecord = asRecord(first)
    if (firstRecord?.value !== undefined) return firstRecord.value
  }
  const schema = asRecord(param.schema)
  if (schema?.default !== undefined) return schema.default
  if (schema?.example !== undefined) return schema.example
  return pickMediaExample({ schema: schema as never })
}

function mergeParameters(
  pathItemParams: unknown,
  operationParams: unknown,
): AnyRecord[] {
  const merged = new Map<string, AnyRecord>()
  for (const list of [pathItemParams, operationParams]) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const param = asRecord(item)
      if (!param?.name || typeof param.name !== 'string') continue
      const location = typeof param.in === 'string' ? param.in : 'query'
      merged.set(`${location}:${param.name}`, param)
    }
  }
  return [...merged.values()]
}

function requiresAuth(
  operationSecurity: unknown,
  documentSecurity: unknown,
): boolean {
  const security =
    operationSecurity !== undefined ? operationSecurity : documentSecurity
  if (!Array.isArray(security)) return false
  if (security.length === 0) return false
  return security.some((requirement) => {
    const req = asRecord(requirement)
    return req !== undefined && Object.keys(req).length > 0
  })
}

function pickRequestBody(operation: AnyRecord): {
  contentType: string | null
  body: unknown | null
} {
  const requestBody = asRecord(operation.requestBody)
  if (!requestBody) {
    // Swagger 2 body/formData parameters
    return { contentType: null, body: null }
  }
  const content = asRecord(requestBody.content)
  const contentType = preferContentType(content)
  if (!contentType || !content) return { contentType: null, body: null }
  const media = asRecord(content[contentType]) ?? {}
  return {
    contentType,
    body: pickMediaExample(media as never),
  }
}

function swagger2Body(params: AnyRecord[]): {
  contentType: string | null
  body: unknown | null
} {
  const bodyParam = params.find((p) => p.in === 'body')
  if (bodyParam) {
    const schema = asRecord(bodyParam.schema)
    return {
      contentType: 'application/json',
      body: pickMediaExample({
        example: bodyParam.example,
        schema: schema as never,
      }),
    }
  }
  const formParams = params.filter(
    (p) => p.in === 'formData' && typeof p.name === 'string',
  )
  if (formParams.length === 0) return { contentType: null, body: null }
  const body: Record<string, unknown> = {}
  for (const param of formParams) {
    body[param.name as string] = parameterExample(param)
  }
  const hasFile = formParams.some((p) => p.type === 'file')
  return {
    contentType: hasFile
      ? 'multipart/form-data'
      : 'application/x-www-form-urlencoded',
    body,
  }
}

function pickResponse(operation: AnyRecord): unknown | null {
  const responses = asRecord(operation.responses)
  if (!responses) return null

  const statusKeys = Object.keys(responses).filter((key) => key !== 'default')
  const success =
    statusKeys.find((key) => /^2\d\d$/.test(key)) ?? statusKeys[0] ?? 'default'
  const response = asRecord(responses[success])
  if (!response) return null

  const content = asRecord(response.content)
  if (content) {
    const contentType = preferContentType(content)
    if (contentType) {
      const media = asRecord(content[contentType]) ?? {}
      return pickMediaExample(media as never)
    }
  }

  // Swagger 2
  if (response.schema) {
    return pickMediaExample({
      example: response.example,
      schema: response.schema as never,
    })
  }
  if (response.example !== undefined) return response.example
  return null
}

function collectServers(
  doc: AnyRecord,
  pathItem: AnyRecord,
  operation: AnyRecord,
): string[] {
  const opServers = Array.isArray(operation.servers) ? operation.servers : []
  const pathServers = Array.isArray(pathItem.servers) ? pathItem.servers : []
  const rootServers = Array.isArray(doc.servers) ? doc.servers : []

  const ordered = [...opServers, ...pathServers, ...rootServers]
  const urls = ordered
    .map((server) => resolveServerUrl(server as never))
    .filter(Boolean)

  if (urls.length > 0) return [...new Set(urls)]

  const swaggerBase = swagger2BaseUrl({
    schemes: doc.schemes as string[] | undefined,
    host: doc.host as string | undefined,
    basePath: doc.basePath as string | undefined,
  })
  return swaggerBase ? [swaggerBase] : ['']
}

export function extractOperations(doc: unknown): ExtractResult {
  const document = asRecord(doc) ?? {}
  const info = asRecord(document.info)
  const paths = asRecord(document.paths) ?? {}
  const operations: ExtractedOperation[] = []
  const allServers = new Set<string>()

  for (const [path, pathValue] of Object.entries(paths)) {
    const pathItem = asRecord(pathValue)
    if (!pathItem) continue

    for (const method of METHODS) {
      const operation = asRecord(pathItem[method])
      if (!operation) continue

      const servers = collectServers(document, pathItem, operation)
      for (const server of servers) {
        if (server) allServers.add(server)
      }
      const serverUrl = servers[0] ?? ''

      const paramsList = mergeParameters(pathItem.parameters, operation.parameters)
      const params: Record<string, unknown> = {}
      const headers: Record<string, string> = {}

      for (const param of paramsList) {
        const name = param.name as string
        const location = param.in as string
        const value = parameterExample(param)
        if (location === 'header') {
          headers[name] = value == null ? '' : String(value)
        } else if (location === 'query') {
          params[name] = value
        }
      }

      let { contentType, body } = pickRequestBody(operation)
      if (contentType === null && body === null) {
        const swaggerBody = swagger2Body(paramsList)
        contentType = swaggerBody.contentType
        body = swaggerBody.body
      }

      const tags = Array.isArray(operation.tags)
        ? operation.tags.filter((t): t is string => typeof t === 'string')
        : []

      operations.push({
        id: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        operationId:
          typeof operation.operationId === 'string'
            ? operation.operationId
            : undefined,
        summary:
          typeof operation.summary === 'string' ? operation.summary : undefined,
        tags,
        serverUrl,
        params,
        body,
        response: pickResponse(operation),
        contentType,
        headers,
        requiresAuth: requiresAuth(operation.security, document.security),
      })
    }
  }

  const meta: ExtractMeta = {
    title:
      typeof info?.title === 'string' && info.title.trim()
        ? info.title
        : 'Untitled API',
    version: typeof info?.version === 'string' ? info.version : undefined,
    servers: [...allServers],
  }

  return { meta, operations }
}

export function toCopiedRequest(
  operation: ExtractedOperation,
  fullyQualified: boolean,
  serverOverride?: string,
  documentBaseUrl?: string,
): CopiedRequest {
  const server = resolveAgainstDocumentBase(
    serverOverride ?? operation.serverUrl,
    documentBaseUrl,
  )
  const url = fullyQualified
    ? joinServerAndPath(server, operation.path)
    : operation.path

  return {
    method: operation.method,
    url,
    params: operation.params,
    body: operation.body,
    response: operation.response,
    contentType: operation.contentType,
    headers: operation.headers,
    requiresAuth: operation.requiresAuth,
  }
}

export function buildCopiedRequests(
  operations: ExtractedOperation[],
  selectedIds: string[],
  fullyQualified: boolean,
  serverOverride?: string,
  documentBaseUrl?: string,
): CopiedRequest[] {
  const byId = new Map(operations.map((op) => [op.id, op]))
  const result: CopiedRequest[] = []
  for (const id of selectedIds) {
    const operation = byId.get(id)
    if (!operation) continue
    result.push(
      toCopiedRequest(operation, fullyQualified, serverOverride, documentBaseUrl),
    )
  }
  return result
}
