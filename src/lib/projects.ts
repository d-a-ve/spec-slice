import localforage from 'localforage'
import type { ExtractedOperation } from './openapi/types'

export type ProjectSource =
  | { kind: 'url'; url: string }
  | { kind: 'text'; filename?: string }

export type Project = {
  id: string
  createdAt: number
  updatedAt: number
  source: ProjectSource
  rawSpec: string
  title: string
  operations: ExtractedOperation[]
  selectedIds: string[]
  fullyQualified: boolean
}

export type ProjectIndexEntry = {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  source: ProjectSource
  endpointCount: number
}

const INDEX_KEY = 'projects:index'

const store = localforage.createInstance({
  name: 'spec-slice',
  storeName: 'projects',
  driver: localforage.INDEXEDDB,
})

function projectKey(id: string): string {
  return `project:${id}`
}

export async function listProjects(): Promise<ProjectIndexEntry[]> {
  const index = (await store.getItem<ProjectIndexEntry[]>(INDEX_KEY)) ?? []
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getProject(id: string): Promise<Project | null> {
  return (await store.getItem<Project>(projectKey(id))) ?? null
}

async function writeIndex(entries: ProjectIndexEntry[]): Promise<void> {
  await store.setItem(INDEX_KEY, entries)
}

function toIndexEntry(project: Project): ProjectIndexEntry {
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    title: project.title,
    source: project.source,
    endpointCount: project.operations.length,
  }
}

export async function saveProject(project: Project): Promise<void> {
  await store.setItem(projectKey(project.id), project)
  const index = (await store.getItem<ProjectIndexEntry[]>(INDEX_KEY)) ?? []
  const next = [toIndexEntry(project), ...index.filter((e) => e.id !== project.id)]
  await writeIndex(next)
}

export async function deleteProject(id: string): Promise<void> {
  await store.removeItem(projectKey(id))
  const index = (await store.getItem<ProjectIndexEntry[]>(INDEX_KEY)) ?? []
  await writeIndex(index.filter((e) => e.id !== id))
}

export function createProjectId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
