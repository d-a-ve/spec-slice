# Spec Slice

Local-first OpenAPI endpoint picker. Load a spec from a URL, paste, or file; select operations; copy a flat JSON request array.

- `/` — landing page
- `/app` — extractor

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy (Vercel)

The SPA builds with Vite. Spec URL fetches go through `api/fetch-spec.ts` (rate-limited to 20 requests / 30 minutes per IP). Paste and file upload do not use that endpoint.

```bash
npm run build
```

## Stack

- Vite + React + TypeScript + Tailwind + React Router
- `@scalar/openapi-parser` for parse/dereference (web worker)
- `localforage` (IndexedDB) for projects
