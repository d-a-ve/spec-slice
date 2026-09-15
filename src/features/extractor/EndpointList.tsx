import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ExtractedOperation } from '../../lib/openapi/types'

const METHOD_CLASS: Record<string, string> = {
  GET: 'text-[var(--method-get)]',
  POST: 'text-[var(--method-post)]',
  PUT: 'text-[var(--method-put)]',
  PATCH: 'text-[var(--method-patch)]',
  DELETE: 'text-[var(--method-delete)]',
}

type Row =
  | { type: 'tag'; tag: string; count: number }
  | { type: 'op'; operation: ExtractedOperation }

type Props = {
  operations: ExtractedOperation[]
  selectedIds: string[]
  activeId: string | null
  search: string
  onSearch: (value: string) => void
  onToggle: (id: string) => void
  onActivate: (id: string) => void
  onSelectAll: () => void
  onClear: () => void
  onSelectTag: (tag: string) => void
}

export function EndpointList({
  operations,
  selectedIds,
  activeId,
  search,
  onSearch,
  onToggle,
  onActivate,
  onSelectAll,
  onClear,
  onSelectTag,
}: Props) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const parentRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return operations
    return operations.filter((op) => {
      const hay = [
        op.path,
        op.method,
        op.operationId ?? '',
        op.summary ?? '',
        ...op.tags,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [operations, search])

  const rows = useMemo(() => {
    const byTag = new Map<string, ExtractedOperation[]>()
    for (const op of filtered) {
      const tags = op.tags.length > 0 ? op.tags : ['untagged']
      for (const tag of tags) {
        const list = byTag.get(tag) ?? []
        if (!list.includes(op)) list.push(op)
        byTag.set(tag, list)
      }
    }
    const result: Row[] = []
    for (const [tag, ops] of [...byTag.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      result.push({ type: 'tag', tag, count: ops.length })
      for (const operation of ops) {
        result.push({ type: 'op', operation })
      }
    }
    return result
  }, [filtered])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index]?.type === 'tag' ? 36 : 44),
    overscan: 12,
  })

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-col gap-2 border-b border-[var(--line)] px-3 py-3">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search path, operationId, tag…"
          className="border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="font-mono text-[11px] text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[11px] text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Clear
          </button>
          <span className="ml-auto font-mono text-[11px] text-[var(--muted)]">
            {selectedIds.length}/{operations.length}
          </span>
        </div>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]
            if (!row) return null
            if (row.type === 'tag') {
              return (
                <div
                  key={`tag-${row.tag}`}
                  className="absolute inset-x-0 flex items-center justify-between px-3"
                  style={{
                    transform: `translateY(${item.start}px)`,
                    height: item.size,
                  }}
                >
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                    {row.tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectTag(row.tag)}
                    className="font-mono text-[10px] text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    select · {row.count}
                  </button>
                </div>
              )
            }

            const op = row.operation
            const isActive = op.id === activeId
            return (
              <div
                key={op.id}
                className={`absolute inset-x-0 flex items-center gap-2 border-b border-[var(--line)]/60 px-3 ${isActive ? 'bg-[var(--surface)]' : ''}`}
                style={{
                  transform: `translateY(${item.start}px)`,
                  height: item.size,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(op.id)}
                  onChange={() => onToggle(op.id)}
                  aria-label={`Select ${op.id}`}
                  className="accent-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => onActivate(op.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-14 shrink-0 font-mono text-[11px] font-semibold ${METHOD_CLASS[op.method] ?? 'text-[var(--ink)]'}`}
                    >
                      {op.method}
                    </span>
                    <span className="truncate font-mono text-xs text-[var(--ink)]">
                      {op.path}
                    </span>
                  </div>
                  {op.summary ? (
                    <p className="truncate pl-[3.75rem] text-[11px] text-[var(--muted)]">
                      {op.summary}
                    </p>
                  ) : null}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
