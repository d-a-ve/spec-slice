import type { IncomingMessage, ServerResponse } from 'node:http'
import { FetchSpecError, fetchSpecText } from './api/lib/fetch-spec.ts'
import { consumeRateLimit, peekRateLimit } from './api/lib/rate-limit.ts'

function clientKey(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  res.end(payload)
}

export async function handleFetchSpecRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/api/fetch-spec') return false

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return true
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return true
  }

  const key = clientKey(req)

  if (url.searchParams.get('peek') === '1') {
    const peek = peekRateLimit(key)
    sendJson(res, 200, peek, {
      'X-RateLimit-Limit': String(peek.limit),
      'X-RateLimit-Remaining': String(peek.remaining),
      'X-RateLimit-Reset': String(Math.floor(peek.resetAt / 1000)),
    })
    return true
  }

  const target = url.searchParams.get('url')
  if (!target) {
    sendJson(res, 400, { error: 'Missing url query parameter' })
    return true
  }

  const limit = consumeRateLimit(key)
  if (!limit.ok) {
    sendJson(
      res,
      429,
      {
        error: 'Rate limit exceeded',
        remaining: 0,
        limit: limit.limit,
        resetAt: limit.resetAt,
      },
      {
        'Retry-After': String(limit.retryAfterSeconds),
        'X-RateLimit-Limit': String(limit.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(limit.resetAt / 1000)),
      },
    )
    return true
  }

  try {
    const text = await fetchSpecText(target)
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-RateLimit-Limit': String(limit.limit),
      'X-RateLimit-Remaining': String(limit.remaining),
      'X-RateLimit-Reset': String(Math.floor(limit.resetAt / 1000)),
    })
    res.end(text)
  } catch (error: unknown) {
    if (error instanceof FetchSpecError) {
      sendJson(
        res,
        error.status,
        { error: error.message },
        {
          'X-RateLimit-Limit': String(limit.limit),
          'X-RateLimit-Remaining': String(limit.remaining),
          'X-RateLimit-Reset': String(Math.floor(limit.resetAt / 1000)),
        },
      )
      return true
    }
    sendJson(res, 500, { error: 'Unexpected error fetching spec' })
  }

  return true
}
