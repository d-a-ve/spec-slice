import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CopyBar } from './CopyBar'
import { EndpointDetail } from './EndpointDetail'
import { EndpointList } from './EndpointList'
import { ProjectList } from './ProjectList'
import { SpecLoader } from './SpecLoader'
import { useProject } from './useProject'

export function ExtractorPage() {
  const session = useProject()
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleFile = async (file: File) => {
    const text = await file.text()
    session.setDraft((prev) => ({
      ...prev,
      text,
      filename: file.name,
      url: '',
    }))
    await session.loadFromText(text, file.name)
  }

  const selectTag = (tag: string) => {
    if (!session.project) return
    const ids = session.project.operations
      .filter((op) =>
        tag === 'untagged' ? op.tags.length === 0 : op.tags.includes(tag),
      )
      .map((op) => op.id)
    const merged = new Set([...session.project.selectedIds, ...ids])
    session.selectAll([...merged])
  }

  return (
    <div className="flex h-svh min-h-0 flex-col bg-[var(--bg)] text-[var(--ink)]">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <Link
          to="/"
          className="font-[family-name:var(--display)] text-xl tracking-tight text-[var(--ink)] no-underline hover:text-[var(--accent)]"
        >
          Spec Slice
        </Link>
        {session.toast ? (
          <span className="border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 font-mono text-xs text-[var(--accent)]">
            {session.toast}
          </span>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ProjectList
          projects={session.projects}
          activeId={session.project?.id ?? null}
          onNew={session.createProject}
          onOpen={(id) => void session.openProject(id)}
          onDelete={(id) => void session.deleteProject(id)}
        />

        <div className="flex min-h-0 min-w-0 flex-col">
          <SpecLoader
            url={session.draft.url}
            text={session.draft.text}
            filename={session.draft.filename}
            load={session.load}
            rateLimit={session.rateLimit}
            projectTitle={session.project?.title}
            endpointCount={session.project?.operations.length}
            hasProject={Boolean(session.project)}
            onUrlChange={(url) =>
              session.setDraft((prev) => ({ ...prev, url }))
            }
            onTextChange={(text) =>
              session.setDraft((prev) => ({ ...prev, text }))
            }
            onLoadUrl={() => void session.loadFromUrl()}
            onLoadText={() => void session.loadFromText()}
            onFile={(file) => void handleFile(file)}
            onReextract={() => void session.reextract()}
          />

          {session.project ? (
            <>
              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.05fr)]">
                <EndpointList
                  operations={session.project.operations}
                  selectedIds={session.project.selectedIds}
                  activeId={session.activeId}
                  search={session.search}
                  onSearch={session.setSearch}
                  onToggle={session.toggle}
                  onActivate={session.setActiveId}
                  onSelectAll={() => session.selectAll()}
                  onClear={session.clearSelection}
                  onSelectTag={selectTag}
                />
                <EndpointDetail
                  copied={session.activeCopied}
                  emptyMessage={
                    session.load.status === 'fetching'
                      ? 'Fetching spec…'
                      : session.load.status === 'extracting'
                        ? 'Extracting endpoints…'
                        : undefined
                  }
                />
              </div>

              {previewOpen ? (
                <pre className="max-h-48 overflow-auto border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 font-mono text-[11px] text-[var(--ink)]">
                  {JSON.stringify(session.copyPayload, null, 2)}
                </pre>
              ) : null}

              <CopyBar
                selectedCount={session.project.selectedIds.length}
                fullyQualified={session.project.fullyQualified}
                onFullyQualifiedChange={session.setFullyQualified}
                onCopy={() => void session.copy()}
                copyLabel={session.copyLabel}
                previewOpen={previewOpen}
                onTogglePreview={() => setPreviewOpen((v) => !v)}
                servers={session.serverOptions}
                serverOverride={session.serverOverride}
                onServerChange={session.setServerOverride}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="max-w-md text-center">
                <p className="font-[family-name:var(--display)] text-xl text-[var(--ink)]">
                  Load an OpenAPI document
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Paste a URL, YAML, or JSON file. Pick endpoints and copy a flat
                  request array for the ones you need.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
