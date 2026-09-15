import { dereference } from '@scalar/openapi-parser'
import { extractOperations } from './extract'
import type { ExtractResult } from './types'

export async function parseAndExtract(rawSpec: string): Promise<ExtractResult> {
  const trimmed = rawSpec.trim()
  if (!trimmed) {
    throw new Error('Spec is empty')
  }

  const { schema, errors } = await dereference(trimmed)
  if (errors && errors.length > 0) {
    const message = errors
      .map((error) => {
        if (typeof error === 'string') return error
        if (error && typeof error === 'object' && 'message' in error) {
          return String((error as { message: unknown }).message)
        }
        return JSON.stringify(error)
      })
      .filter(Boolean)
      .join('; ')
    throw new Error(message || 'Failed to parse OpenAPI document')
  }
  if (!schema || typeof schema !== 'object') {
    throw new Error('Failed to parse OpenAPI document')
  }

  // Some invalid documents dereference without schema.paths
  if (!('paths' in schema) || !schema.paths) {
    throw new Error('Document has no paths to extract')
  }

  return extractOperations(schema)
}
