type ServerObject = {
  url: string
  variables?: Record<
    string,
    { default?: string; enum?: string[]; description?: string }
  >
}

export function resolveServerUrl(server: ServerObject | string | undefined): string {
  if (!server) return ''
  if (typeof server === 'string') return substituteServerVariables(server, {})
  return substituteServerVariables(server.url, server.variables ?? {})
}

function substituteServerVariables(
  url: string,
  variables: Record<string, { default?: string; enum?: string[] }>,
): string {
  return url.replace(/\{([^}]+)\}/g, (match, name: string) => {
    const variable = variables[name]
    if (!variable) return match
    if (variable.default !== undefined) return variable.default
    if (variable.enum?.[0] !== undefined) return variable.enum[0]
    return match
  })
}

export function joinServerAndPath(serverUrl: string, path: string): string {
  if (!serverUrl) return path
  const base = serverUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  if (base.endsWith(suffix)) return base
  return `${base}${suffix}`
}

/** Resolve a relative OpenAPI server URL against the document's fetch/origin URL. */
export function resolveAgainstDocumentBase(
  serverUrl: string,
  documentBaseUrl?: string,
): string {
  if (!serverUrl) return documentBaseUrl ?? ''
  if (/^https?:\/\//i.test(serverUrl)) return serverUrl
  if (!documentBaseUrl) return serverUrl
  try {
    return new URL(serverUrl, documentBaseUrl).toString().replace(/\/+$/, '')
  } catch {
    return serverUrl
  }
}

export function swagger2BaseUrl(doc: {
  schemes?: string[]
  host?: string
  basePath?: string
}): string {
  if (!doc.host) return ''
  const scheme = doc.schemes?.[0] ?? 'https'
  const basePath = doc.basePath ?? ''
  return `${scheme}://${doc.host}${basePath}`.replace(/\/+$/, '')
}
