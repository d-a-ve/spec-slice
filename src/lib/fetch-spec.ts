const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal'])

function isPrivateIp(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(lower)) return true
  if (lower.endsWith('.localhost') || lower.endsWith('.local')) return true

  // IPv4
  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number)
    if (parts.some((n) => n > 255)) return true
    const [a, b] = parts
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }

  // IPv6 loopback / link-local / unique local
  if (lower === '::1') return true
  if (lower.startsWith('fe80:')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return isPrivateIp(lower.slice(1, -1))
  }

  return false
}

export function assertSafeSpecUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new FetchSpecError('Invalid URL', 400)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new FetchSpecError('Only http and https URLs are allowed', 400)
  }

  if (isPrivateIp(parsed.hostname)) {
    throw new FetchSpecError('URL host is not allowed', 400)
  }

  return parsed
}

export class FetchSpecError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'FetchSpecError'
    this.status = status
  }
}

const MAX_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 8000

export async function fetchSpecText(rawUrl: string): Promise<string> {
  const target = assertSafeSpecUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'application/json, application/yaml, text/yaml, text/plain, */*' },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        throw new FetchSpecError('Redirect without location', 502)
      }
      const redirected = new URL(location, target)
      assertSafeSpecUrl(redirected.toString())
      return fetchSpecText(redirected.toString())
    }

    if (!response.ok) {
      throw new FetchSpecError(
        `Upstream returned ${response.status}`,
        response.status === 404 ? 404 : 502,
      )
    }

    const lengthHeader = response.headers.get('content-length')
    if (lengthHeader && Number(lengthHeader) > MAX_BYTES) {
      throw new FetchSpecError('Spec exceeds 5MB limit', 413)
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_BYTES) {
      throw new FetchSpecError('Spec exceeds 5MB limit', 413)
    }

    return new TextDecoder('utf-8').decode(buffer)
  } catch (error) {
    if (error instanceof FetchSpecError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchSpecError('Request timed out', 504)
    }
    throw new FetchSpecError(
      error instanceof Error ? error.message : 'Failed to fetch spec',
      502,
    )
  } finally {
    clearTimeout(timer)
  }
}
