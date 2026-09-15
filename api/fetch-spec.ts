import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FetchSpecError, fetchSpecText } from './lib/fetch-spec.js'
import { consumeRateLimit, peekRateLimit } from './lib/rate-limit.js'

function clientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim()
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]!.trim()
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const key = clientKey(req)
  const urlParam = typeof req.query.url === 'string' ? req.query.url : undefined
  const peek = req.query.peek === '1' || req.query.peek === 'true'

  if (peek) {
    const status = peekRateLimit(key)
    res.setHeader('X-RateLimit-Limit', String(status.limit))
    res.setHeader('X-RateLimit-Remaining', String(status.remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.floor(status.resetAt / 1000)))
    res.status(200).json(status)
    return
  }

  if (!urlParam) {
    res.status(400).json({ error: 'Missing url query parameter' })
    return
  }

  const limit = consumeRateLimit(key)
  res.setHeader('X-RateLimit-Limit', String(limit.limit))
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.floor(limit.resetAt / 1000)))

  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds))
    res.status(429).json({
      error: 'Rate limit exceeded',
      remaining: 0,
      limit: limit.limit,
      resetAt: limit.resetAt,
    })
    return
  }

  try {
    const text = await fetchSpecText(urlParam)
    res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8').send(text)
  } catch (error: unknown) {
    if (error instanceof FetchSpecError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    res.status(500).json({ error: 'Unexpected error fetching spec' })
  }
}
