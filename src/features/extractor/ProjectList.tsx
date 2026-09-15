import type { ProjectIndexEntry } from '../../lib/projects'

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

function sourceLabel(entry: ProjectIndexEntry): string {
  if (entry.source.kind === 'url') return entry.source.url
  return entry.source.filename ?? 'pasted text'
}

type Props = {
  projects: ProjectIndexEntry[]
  activeId: string | null
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export function ProjectList({
  projects,
  activeId,
  onNew,
  onOpen,
  onDelete,
}: Props) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--muted)] uppercase">
            Projects
          </p>
          <p className="font-mono text-xs text-[var(--ink)]">{projects.length} saved</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-xs text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[var(--muted)]">
            No projects yet. Load a spec to create one.
          </p>
        ) : (
          <ul className="flex flex-col">
            {projects.map((entry) => {
              const selected = entry.id === activeId
              return (
                <li key={entry.id} className="border-b border-[var(--line)]">
                  <div
                    className={`flex items-start gap-2 px-3 py-3 ${selected ? 'bg-[var(--surface)]' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(entry.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {entry.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted)]">
                        {sourceLabel(entry)}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                        {entry.endpointCount} endpoints · {formatTime(entry.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => onDelete(entry.id)}
                      className="shrink-0 px-1 font-mono text-xs text-[var(--muted)] hover:text-[var(--method-delete)]"
                    >
                      ×
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
