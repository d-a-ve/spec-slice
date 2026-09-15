type Props = {
  selectedCount: number
  fullyQualified: boolean
  onFullyQualifiedChange: (value: boolean) => void
  onCopy: () => void
  copyLabel: string
  previewOpen: boolean
  onTogglePreview: () => void
  servers: string[]
  serverOverride?: string
  onServerChange: (value: string | undefined) => void
}

export function CopyBar({
  selectedCount,
  fullyQualified,
  onFullyQualifiedChange,
  onCopy,
  copyLabel,
  previewOpen,
  onTogglePreview,
  servers,
  serverOverride,
  onServerChange,
}: Props) {
  return (
    <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3">
      <p className="font-mono text-xs text-[var(--muted)]">
        {selectedCount} selected
      </p>

      <label className="flex cursor-pointer items-center gap-2 font-mono text-xs text-[var(--ink)]">
        <input
          type="checkbox"
          checked={fullyQualified}
          onChange={(e) => onFullyQualifiedChange(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Fully qualified URLs
      </label>

      {fullyQualified && servers.length > 1 ? (
        <select
          value={serverOverride ?? servers[0] ?? ''}
          onChange={(e) => onServerChange(e.target.value || undefined)}
          className="max-w-64 cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-2 py-1 font-mono text-[11px] text-[var(--ink)] outline-none"
        >
          {servers.map((server) => (
            <option key={server} value={server}>
              {server}
            </option>
          ))}
        </select>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePreview}
          className="cursor-pointer border border-[var(--line)] px-3 py-1.5 font-mono text-xs text-[var(--muted)] hover:text-[var(--ink)]"
        >
          {previewOpen ? 'Hide JSON' : 'Show JSON'}
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={selectedCount === 0}
          className="cursor-pointer bg-[var(--accent)] px-4 py-1.5 font-mono text-xs font-semibold text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copyLabel}
        </button>
      </div>
    </footer>
  )
}
