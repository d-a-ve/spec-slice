import type { LoadStatus, RateLimitInfo } from './useProject'

type Props = {
  url: string
  text: string
  filename?: string
  load: LoadStatus
  rateLimit: RateLimitInfo
  projectTitle?: string
  endpointCount?: number
  hasProject: boolean
  onUrlChange: (url: string) => void
  onTextChange: (text: string) => void
  onLoadUrl: () => void
  onLoadText: () => void
  onFile: (file: File) => void
  onReextract: () => void
}

export function SpecLoader({
  url,
  text,
  filename,
  load,
  rateLimit,
  projectTitle,
  endpointCount,
  hasProject,
  onUrlChange,
  onTextChange,
  onLoadUrl,
  onLoadText,
  onFile,
  onReextract,
}: Props) {
  const busy = load.status === 'fetching' || load.status === 'extracting'
  const urlBlocked = rateLimit.remaining <= 0

  return (
    <section className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--muted)] uppercase">
            Spec source
          </p>
          <h1 className="mt-1 font-[family-name:var(--display)] text-2xl tracking-tight text-[var(--ink)]">
            {projectTitle ?? 'New project'}
          </h1>
          {endpointCount !== undefined && load.status === 'ready' ? (
            <p className="mt-1 font-mono text-xs text-[var(--muted)]">
              {endpointCount} endpoints extracted
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-mono text-[11px] ${urlBlocked ? 'text-[var(--method-delete)]' : 'text-[var(--muted)]'}`}
          >
            URL fetches left: {rateLimit.remaining}/{rateLimit.limit}
          </span>
          {hasProject ? (
            <button
              type="button"
              disabled={busy || (urlBlocked && Boolean(url.trim()))}
              onClick={onReextract}
              className="border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs text-[var(--ink)] enabled:hover:border-[var(--accent)] disabled:opacity-40"
            >
              Re-extract
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="font-mono text-[11px] text-[var(--muted)]" htmlFor="spec-url">
            Spec URL
          </label>
          <div className="flex gap-2">
            <input
              id="spec-url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/openapi.json"
              className="min-w-0 flex-1 border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              disabled={busy || urlBlocked}
              onClick={onLoadUrl}
              className="shrink-0 bg-[var(--ink)] px-4 py-2 font-mono text-xs text-[var(--bg)] enabled:hover:bg-[var(--accent)] disabled:opacity-40"
            >
              {load.status === 'fetching' ? 'Fetching…' : 'Load URL'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] text-[var(--muted)]" htmlFor="spec-text">
            Paste YAML / JSON {filename ? `· ${filename}` : ''}
          </label>
          <textarea
            id="spec-text"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={4}
            placeholder="Paste an OpenAPI document…"
            className="resize-y border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onLoadText}
            className="border border-[var(--line)] bg-[var(--surface)] px-4 py-2 font-mono text-xs text-[var(--ink)] enabled:hover:border-[var(--accent)] disabled:opacity-40"
          >
            {load.status === 'extracting' ? 'Extracting…' : 'Extract text'}
          </button>
          <label className="cursor-pointer border border-dashed border-[var(--line)] px-4 py-2 text-center font-mono text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
            Upload file
            <input
              type="file"
              accept=".json,.yaml,.yml,application/json,text/yaml,text/x-yaml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFile(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      {load.status === 'error' ? (
        <p className="mt-3 border border-[var(--method-delete)]/40 bg-[var(--method-delete)]/10 px-3 py-2 font-mono text-xs text-[var(--method-delete)]">
          {load.message}
        </p>
      ) : null}
    </section>
  )
}
