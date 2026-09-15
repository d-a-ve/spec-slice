import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildCopiedRequests, resolveAgainstDocumentBase } from '../../lib/openapi'
import type { ExtractedOperation } from '../../lib/openapi/types'
import {
  createProjectId,
  deleteProject as deleteProjectRecord,
  getProject,
  listProjects,
  saveProject,
  type Project,
  type ProjectIndexEntry,
  type ProjectSource,
} from '../../lib/projects'
import { extractInWorker } from './extract-client'

export type LoadStatus =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'extracting' }
  | { status: 'error'; message: string }
  | { status: 'ready' }

export type RateLimitInfo = {
  remaining: number
  limit: number
  resetAt: number
}

type DraftSource = {
  url: string
  text: string
  filename?: string
}

async function fetchSpecFromApi(url: string): Promise<{
  text: string
  rateLimit: RateLimitInfo
}> {
  const response = await fetch(`/api/fetch-spec?url=${encodeURIComponent(url)}`)
  const remaining = Number(response.headers.get('X-RateLimit-Remaining') ?? '20')
  const limit = Number(response.headers.get('X-RateLimit-Limit') ?? '20')
  const resetAt =
    Number(response.headers.get('X-RateLimit-Reset') ?? '0') * 1000 ||
    Date.now() + 30 * 60 * 1000

  if (!response.ok) {
    let message = `Fetch failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore
    }
    const error = new Error(message) as Error & { rateLimit?: RateLimitInfo }
    error.rateLimit = { remaining: response.status === 429 ? 0 : remaining, limit, resetAt }
    throw error
  }

  const text = await response.text()
  return { text, rateLimit: { remaining, limit, resetAt } }
}

async function peekRateLimit(): Promise<RateLimitInfo> {
  try {
    const response = await fetch('/api/fetch-spec?peek=1')
    if (!response.ok) {
      return { remaining: 20, limit: 20, resetAt: Date.now() + 30 * 60 * 1000 }
    }
    return (await response.json()) as RateLimitInfo
  } catch {
    return { remaining: 20, limit: 20, resetAt: Date.now() + 30 * 60 * 1000 }
  }
}

function filterSelectedIds(
  selectedIds: string[],
  operations: ExtractedOperation[],
): string[] {
  const ids = new Set(operations.map((op) => op.id))
  return selectedIds.filter((id) => ids.has(id))
}

export function useProject() {
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [draft, setDraft] = useState<DraftSource>({ url: '', text: '' })
  const [load, setLoad] = useState<LoadStatus>({ status: 'idle' })
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [serverOverride, setServerOverride] = useState<string | undefined>()
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({
    remaining: 20,
    limit: 20,
    resetAt: Date.now() + 30 * 60 * 1000,
  })
  const [toast, setToast] = useState<string | null>(null)
  const [copyLabel, setCopyLabel] = useState('Copy JSON')
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectRef = useRef<Project | null>(null)
  const copyLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    projectRef.current = project
  }, [project])

  const refreshProjects = useCallback(async () => {
    setProjects(await listProjects())
  }, [])

  useEffect(() => {
    void refreshProjects()
    void peekRateLimit().then(setRateLimit)
  }, [refreshProjects])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const spec = params.get('spec')
    if (spec) {
      setDraft((prev) => ({ ...prev, url: spec }))
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  const schedulePersist = useCallback((next: Project) => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void saveProject(next)
        .then(() => refreshProjects())
        .catch(() => {
          setToast('Could not save project to IndexedDB')
        })
    }, 300)
  }, [refreshProjects])

  const createProject = useCallback(() => {
    setProject(null)
    setDraft({ url: '', text: '' })
    setLoad({ status: 'idle' })
    setSearch('')
    setActiveId(null)
    setServerOverride(undefined)
  }, [])

  const openProject = useCallback(async (id: string) => {
    const record = await getProject(id)
    if (!record) {
      setLoad({ status: 'error', message: 'Project not found' })
      return
    }
    setProject(record)
    setDraft({
      url: record.source.kind === 'url' ? record.source.url : '',
      text: record.source.kind === 'text' ? record.rawSpec : '',
      filename:
        record.source.kind === 'text' ? record.source.filename : undefined,
    })
    setLoad({ status: 'ready' })
    setActiveId(record.selectedIds[0] ?? record.operations[0]?.id ?? null)
    setServerOverride(undefined)
  }, [])

  const persistExtract = useCallback(
    async (args: {
      existing: Project | null
      source: ProjectSource
      rawSpec: string
      title: string
      operations: ExtractedOperation[]
    }) => {
      const now = Date.now()
      const selectedIds = args.existing
        ? filterSelectedIds(args.existing.selectedIds, args.operations)
        : []
      const next: Project = {
        id: args.existing?.id ?? createProjectId(),
        createdAt: args.existing?.createdAt ?? now,
        updatedAt: now,
        source: args.source,
        rawSpec: args.rawSpec,
        title: args.title,
        operations: args.operations,
        selectedIds,
        fullyQualified: args.existing?.fullyQualified ?? false,
      }
      try {
        await saveProject(next)
        await refreshProjects()
      } catch {
        setToast('Could not save project to IndexedDB')
      }
      setProject(next)
      setActiveId(selectedIds[0] ?? next.operations[0]?.id ?? null)
      setLoad({ status: 'ready' })
    },
    [refreshProjects],
  )

  const runExtract = useCallback(
    async (rawSpec: string, source: ProjectSource) => {
      setLoad({ status: 'extracting' })
      try {
        const result = await extractInWorker(rawSpec)
        await persistExtract({
          existing: projectRef.current,
          source,
          rawSpec,
          title: result.meta.title,
          operations: result.operations,
        })
        if (result.meta.servers[0]) {
          setServerOverride(undefined)
        }
      } catch (error) {
        setLoad({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Failed to extract endpoints',
        })
      }
    },
    [persistExtract],
  )

  const loadFromUrl = useCallback(
    async (url?: string) => {
      const target = (url ?? draft.url).trim()
      if (!target) {
        setLoad({ status: 'error', message: 'Enter a spec URL' })
        return
      }
      if (rateLimit.remaining <= 0) {
        setLoad({
          status: 'error',
          message: 'URL fetch rate limit reached. Try again later or paste the spec.',
        })
        return
      }

      setLoad({ status: 'fetching' })
      try {
        const { text, rateLimit: nextLimit } = await fetchSpecFromApi(target)
        setRateLimit(nextLimit)
        setDraft((prev) => ({ ...prev, url: target, text: '' }))
        await runExtract(text, { kind: 'url', url: target })
      } catch (error) {
        const withLimit = error as Error & { rateLimit?: RateLimitInfo }
        if (withLimit.rateLimit) setRateLimit(withLimit.rateLimit)
        setLoad({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Failed to fetch spec',
        })
      }
    },
    [draft.url, rateLimit.remaining, runExtract],
  )

  const loadFromText = useCallback(
    async (text?: string, filename?: string) => {
      const raw = (text ?? draft.text).trim()
      if (!raw) {
        setLoad({ status: 'error', message: 'Paste or upload an OpenAPI document' })
        return
      }
      setDraft((prev) => ({
        ...prev,
        text: raw,
        filename: filename ?? prev.filename,
        url: '',
      }))
      await runExtract(raw, {
        kind: 'text',
        filename: filename ?? draft.filename,
      })
    },
    [draft.filename, draft.text, runExtract],
  )

  const reextract = useCallback(async () => {
    const current = projectRef.current
    if (!current) {
      if (draft.url.trim()) {
        await loadFromUrl(draft.url)
        return
      }
      if (draft.text.trim()) {
        await loadFromText(draft.text, draft.filename)
        return
      }
      setLoad({ status: 'error', message: 'Nothing to re-extract yet' })
      return
    }

    if (current.source.kind === 'url') {
      await loadFromUrl(current.source.url)
      return
    }

    await runExtract(current.rawSpec, current.source)
  }, [draft.filename, draft.text, draft.url, loadFromText, loadFromUrl, runExtract])

  const updateProject = useCallback(
    (updater: (prev: Project) => Project) => {
      setProject((prev) => {
        if (!prev) return prev
        const next = updater(prev)
        schedulePersist(next)
        return next
      })
    },
    [schedulePersist],
  )

  const toggle = useCallback(
    (id: string) => {
      updateProject((prev) => {
        const selected = new Set(prev.selectedIds)
        if (selected.has(id)) selected.delete(id)
        else selected.add(id)
        return { ...prev, selectedIds: [...selected], updatedAt: Date.now() }
      })
    },
    [updateProject],
  )

  const selectAll = useCallback(
    (ids?: string[]) => {
      updateProject((prev) => ({
        ...prev,
        selectedIds: ids ?? prev.operations.map((op) => op.id),
        updatedAt: Date.now(),
      }))
    },
    [updateProject],
  )

  const clearSelection = useCallback(() => {
    updateProject((prev) => ({
      ...prev,
      selectedIds: [],
      updatedAt: Date.now(),
    }))
  }, [updateProject])

  const setFullyQualified = useCallback(
    (fullyQualified: boolean) => {
      updateProject((prev) => ({
        ...prev,
        fullyQualified,
        updatedAt: Date.now(),
      }))
    },
    [updateProject],
  )

  const deleteProject = useCallback(
    async (id: string) => {
      await deleteProjectRecord(id)
      await refreshProjects()
      if (projectRef.current?.id === id) {
        createProject()
      }
    },
    [createProject, refreshProjects],
  )

  const copyPayload = useMemo(() => {
    if (!project) return []
    const documentBaseUrl =
      project.source.kind === 'url' ? project.source.url : undefined
    return buildCopiedRequests(
      project.operations,
      project.selectedIds,
      project.fullyQualified,
      serverOverride,
      documentBaseUrl,
    )
  }, [project, serverOverride])

  const copy = useCallback(async () => {
    if (!project || project.selectedIds.length === 0) {
      setCopyLabel('Select endpoints')
      if (copyLabelTimer.current) clearTimeout(copyLabelTimer.current)
      copyLabelTimer.current = setTimeout(() => setCopyLabel('Copy JSON'), 2400)
      return
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(copyPayload, null, 2))
      const count = copyPayload.length
      setCopyLabel(
        `Copied ${count} endpoint${count === 1 ? '' : 's'}`,
      )
      if (copyLabelTimer.current) clearTimeout(copyLabelTimer.current)
      copyLabelTimer.current = setTimeout(() => setCopyLabel('Copy JSON'), 2400)
    } catch {
      setCopyLabel('Copy failed')
      if (copyLabelTimer.current) clearTimeout(copyLabelTimer.current)
      copyLabelTimer.current = setTimeout(() => setCopyLabel('Copy JSON'), 2400)
    }
  }, [copyPayload, project])

  const activeOperation = useMemo(() => {
    if (!project || !activeId) return null
    return project.operations.find((op) => op.id === activeId) ?? null
  }, [activeId, project])

  const activeCopied = useMemo(() => {
    if (!activeOperation || !project) return null
    const documentBaseUrl =
      project.source.kind === 'url' ? project.source.url : undefined
    return (
      buildCopiedRequests(
        [activeOperation],
        [activeOperation.id],
        project.fullyQualified,
        serverOverride,
        documentBaseUrl,
      )[0] ?? null
    )
  }, [activeOperation, project, serverOverride])

  const serverOptions = useMemo(() => {
    if (!project) return []
    const documentBaseUrl =
      project.source.kind === 'url' ? project.source.url : undefined
    const urls = project.operations
      .map((op) =>
        resolveAgainstDocumentBase(op.serverUrl, documentBaseUrl),
      )
      .filter(Boolean)
    return [...new Set(urls)]
  }, [project])

  return {
    projects,
    project,
    draft,
    setDraft,
    load,
    search,
    setSearch,
    activeId,
    setActiveId,
    serverOverride,
    setServerOverride,
    rateLimit,
    toast,
    copyLabel,
    createProject,
    openProject,
    loadFromUrl,
    loadFromText,
    reextract,
    toggle,
    selectAll,
    clearSelection,
    setFullyQualified,
    deleteProject,
    copy,
    copyPayload,
    activeOperation,
    activeCopied,
    serverOptions,
  }
}
