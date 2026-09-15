import { Link } from 'react-router-dom'

const SAMPLE = `[
  {
    "method": "GET",
    "url": "https://api.example.com/pets/{petId}",
    "params": { "status": "available" },
    "body": null,
    "response": { "id": 1, "name": "doggie" },
    "contentType": null,
    "headers": {},
    "requiresAuth": true
  }
]`

const ROWS = [
  { method: 'GET', path: '/pets/{petId}', tone: 'var(--method-get)' },
  { method: 'POST', path: '/pets', tone: 'var(--method-post)' },
  { method: 'PUT', path: '/pets/{petId}', tone: 'var(--method-put)' },
  { method: 'DELETE', path: '/pets/{petId}', tone: 'var(--method-delete)' },
]

export function LandingPage() {
  return (
    <div className="landing min-h-svh text-[var(--ink)]">
      <header className="landing-fade relative z-10 flex items-center justify-between px-5 py-5 md:px-10">
        <span className="font-[family-name:var(--display)] text-lg tracking-tight md:text-xl">
          Spec Slice
        </span>
        <Link
          to="/app"
          className="border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs text-[var(--ink)] no-underline hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Open app
        </Link>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] w-full max-w-6xl flex-col justify-center px-5 pb-16 pt-6 md:px-10">
        <div className="landing-fade landing-delay-1 max-w-3xl">
          <p className="font-[family-name:var(--display)] text-[clamp(3rem,12vw,7.5rem)] leading-[0.9] tracking-[-0.04em] text-[var(--ink)]">
            Spec Slice
          </p>
          <h1 className="mt-6 max-w-xl text-2xl font-medium tracking-tight text-[var(--ink)] md:text-3xl">
            Pull the endpoints you need from an OpenAPI spec.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Load a URL or paste YAML/JSON, select operations, and copy a flat
            request array—ready to drop into your code.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/app"
              className="bg-[var(--accent)] px-5 py-3 font-mono text-sm font-semibold text-[var(--bg)] no-underline hover:brightness-110"
            >
              Start slicing
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="landing-fade landing-delay-2 landing-stage mt-14 w-full overflow-hidden border border-[var(--line)] bg-[var(--panel)]"
        >
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 font-mono text-[10px] text-[var(--muted)]">
            <span className="size-2 rounded-full bg-[var(--method-delete)]/80" />
            <span className="size-2 rounded-full bg-[var(--method-put)]/80" />
            <span className="size-2 rounded-full bg-[var(--method-post)]/80" />
            <span className="ml-2">openapi.json · 4 selected</span>
          </div>
          <div className="grid md:grid-cols-2">
            <ul className="divide-y divide-[var(--line)] border-b border-[var(--line)] md:border-r md:border-b-0">
              {ROWS.map((row) => (
                <li
                  key={row.path + row.method}
                  className="flex items-center gap-3 px-4 py-3 font-mono text-xs"
                >
                  <span
                    className="w-14 shrink-0 font-semibold"
                    style={{ color: row.tone }}
                  >
                    {row.method}
                  </span>
                  <span className="truncate text-[var(--ink)]">{row.path}</span>
                  <span className="ml-auto text-[var(--accent)]">✓</span>
                </li>
              ))}
            </ul>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
              {SAMPLE}
            </pre>
          </div>
        </div>
      </main>
    </div>
  )
}
