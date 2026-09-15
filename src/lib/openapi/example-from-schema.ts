type JsonSchema = {
  type?: string | string[]
  enum?: unknown[]
  default?: unknown
  example?: unknown
  examples?: unknown[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  allOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  required?: string[]
  nullable?: boolean
  additionalProperties?: boolean | JsonSchema
}

function primaryType(schema: JsonSchema): string | undefined {
  if (Array.isArray(schema.type)) {
    return schema.type.find((t) => t !== 'null') ?? schema.type[0]
  }
  return schema.type
}

export function exampleFromSchema(
  schema: JsonSchema | undefined,
  depth = 0,
): unknown {
  if (!schema || depth > 8) return null

  if (schema.example !== undefined) return schema.example
  if (Array.isArray(schema.examples) && schema.examples.length > 0) {
    return schema.examples[0]
  }
  if (schema.default !== undefined) return schema.default
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0]
  }

  const composed = schema.allOf?.[0] ?? schema.oneOf?.[0] ?? schema.anyOf?.[0]
  if (composed && !schema.type && !schema.properties) {
    return exampleFromSchema(composed, depth + 1)
  }

  const type = primaryType(schema)

  switch (type) {
    case 'string':
      return 'string'
    case 'number':
      return 0
    case 'integer':
      return 0
    case 'boolean':
      return false
    case 'array': {
      const item = exampleFromSchema(schema.items, depth + 1)
      return item === null ? [] : [item]
    }
    case 'object':
    case undefined: {
      if (schema.properties) {
        const obj: Record<string, unknown> = {}
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = exampleFromSchema(prop, depth + 1)
        }
        return obj
      }
      if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === 'object'
      ) {
        return {
          key: exampleFromSchema(schema.additionalProperties, depth + 1),
        }
      }
      return type === 'object' ? {} : null
    }
    case 'null':
      return null
    default:
      return null
  }
}

export function pickMediaExample(media: {
  example?: unknown
  examples?: Record<string, { value?: unknown }>
  schema?: JsonSchema
}): unknown {
  if (media.example !== undefined) return media.example
  if (media.examples) {
    const first = Object.values(media.examples)[0]
    if (first?.value !== undefined) return first.value
  }
  if (media.schema?.default !== undefined) return media.schema.default
  return exampleFromSchema(media.schema)
}
