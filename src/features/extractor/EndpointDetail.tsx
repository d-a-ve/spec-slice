import type { CopiedRequest } from '../../lib/openapi/types'

type Props = {
  copied: CopiedRequest | null
  emptyMessage?: string
}

export function EndpointDetail({ copied, emptyMessage }: Props) {
  if (!copied) {
    return (
      <section className="flex h-full items-center justify-center bg-[var(--bg)] px-6 text-sm text-[var(--muted)]">
        {emptyMessage ?? 'Select an endpoint to preview the copied object'}
      </section>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--muted)] uppercase">
          Preview
        </p>
        <p className="mt-1 font-mono text-sm text-[var(--ink)]">
          {copied.method} {copied.url}
        </p>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto px-4 py-4 font-mono text-[11px] leading-relaxed text-[var(--ink)]">
        {JSON.stringify(copied, null, 2)}
      </pre>
    </section>
  )
}
