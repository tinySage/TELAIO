/**
 * Projects and revision history. A revision is an immutable, hash-sealed snapshot of the whole
 * engineering workspace (every lab's stored state), chained to its parent like a commit. Restoring a
 * revision loads it into the workspace without rewriting history. Projects export and import as files
 * whose every revision seal and parent link is checked.
 *
 * Storage-agnostic: functions take a WorkspaceStore so they can be tested without a browser.
 */
import { canonicalJson, hashOf } from '../sim/packages'
import { parts } from '../model/components'
import { interfaces, installPrerequisites } from '../model/assembly'
import { PROVENANCES, quantityIssues, type Provenance, type Quantity } from '../engineering/quantity'

export type WorkspaceStore = { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void }

/** Every key that holds engineering state, with a human label for diffs and reports. */
export const WORKSPACE_DOMAINS: { key: string; label: string }[] = [
  { key: 'telaio.viewStates.v1', label: 'Workbench saved states' },
  { key: 'telaio.massConfigurations.v1', label: 'Mass properties' },
  { key: 'telaio.suspension.v1', label: 'Suspension' },
  { key: 'telaio.brakingInputs.v1', label: 'Braking inputs' },
  { key: 'telaio.brakingStudies.v1', label: 'Braking studies' },
  { key: 'telaio.aero.v1', label: 'Aerodynamics' },
  { key: 'telaio.dynamics.v1', label: 'Vehicle dynamics' },
  { key: 'telaio.simulationJobs.v1', label: 'Simulation jobs and packages' },
  { key: 'telaio.externalSolvers.v1', label: 'External solvers' },
]

export type Snapshot = Record<string, unknown>

export function captureWorkspace(store: WorkspaceStore): Snapshot {
  const snapshot: Snapshot = {}
  for (const { key } of WORKSPACE_DOMAINS) {
    const raw = store.get(key)
    if (raw === null) continue
    try { snapshot[key] = JSON.parse(raw) } catch { /* unreadable entries are not captured */ }
  }
  return snapshot
}

/** Replaces the workspace with a snapshot: domains absent from the snapshot are cleared. */
export function restoreWorkspace(store: WorkspaceStore, snapshot: Snapshot) {
  for (const { key } of WORKSPACE_DOMAINS) {
    if (key in snapshot) store.set(key, JSON.stringify(snapshot[key]))
    else store.remove(key)
  }
}

/** Fingerprint of the assembly model a revision was made against: component IDs, interfaces, install rules. */
export async function assemblyFingerprint(source = { parts, interfaces, installPrerequisites }): Promise<string> {
  return hashOf({
    parts: source.parts.map((p) => ({ id: p.id, position: p.position, segments: p.segments ?? null })).sort((a, b) => a.id.localeCompare(b.id)),
    interfaces: source.interfaces.map((i) => [i.id, i.ownerId, i.targetId, i.type]).sort(),
    prerequisites: source.installPrerequisites,
  })
}

export type ReviewNote = { reviewer: string; verdict: 'approved' | 'changes-requested' | 'comment'; comment: string; at: string }

export type Revision = {
  id: string
  parentId: string | null
  message: string
  author: string
  createdAt: string
  snapshot: Snapshot
  /** Assembly-model fingerprint and asset integrity hashes at commit time. */
  context: { assembly: string; assets: Record<string, string> }
  /** SHA-256 of canonicalJson of every field above. */
  sha256: string
  /** Review notes are annotations, not part of the sealed content. */
  reviews: ReviewNote[]
}

export type StudyDefinition = { id: string; name: string; solver: string; overrides: { path: string; value: number; provenance: Provenance; note: string }[] }

export type Project = { id: string; name: string; description: string; createdAt: string; revisions: Revision[]; studies: StudyDefinition[] }

const sealedPart = (r: Omit<Revision, 'sha256' | 'reviews'> | Revision) => ({ id: r.id, parentId: r.parentId, message: r.message, author: r.author, createdAt: r.createdAt, snapshot: r.snapshot, context: r.context })

export async function commitRevision(project: Project, snapshot: Snapshot, message: string, author: string, context: Revision['context'], createdAt = new Date().toISOString()): Promise<Revision> {
  const head = project.revisions[project.revisions.length - 1] ?? null
  const body = { id: 'rev-' + (project.revisions.length + 1).toString().padStart(4, '0'), parentId: head?.id ?? null, message: message.trim() || 'Untitled revision', author: author.trim() || 'Unknown', createdAt, snapshot, context }
  return { ...body, sha256: await hashOf(body), reviews: [] }
}

/** Checks every revision seal and that each revision's parent is the one before it. */
export async function verifyHistory(project: Project): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []
  for (let i = 0; i < project.revisions.length; i++) {
    const r = project.revisions[i]
    if ((await hashOf(sealedPart(r))) !== r.sha256) errors.push(`${r.id} "${r.message}": seal broken, content was edited`)
    const expectedParent = i === 0 ? null : project.revisions[i - 1].id
    if (r.parentId !== expectedParent) errors.push(`${r.id}: parent is ${r.parentId ?? 'none'}, expected ${expectedParent ?? 'none'}`)
  }
  return { valid: errors.length === 0, errors }
}

export const PROJECT_FILE_FORMAT = 'telaio.project'
export type ProjectFile = { format: typeof PROJECT_FILE_FORMAT; formatVersion: 1; exportedAt: string; project: Project }

export const exportProject = (project: Project, exportedAt = new Date().toISOString()): ProjectFile => ({ format: PROJECT_FILE_FORMAT, formatVersion: 1, exportedAt, project })

export async function importProject(file: unknown): Promise<{ project: Project | null; errors: string[] }> {
  const f = file as ProjectFile
  if (f?.format !== PROJECT_FILE_FORMAT || !f.project || !Array.isArray(f.project.revisions)) return { project: null, errors: ['Not a TELAIO project file'] }
  const project: Project = { ...f.project, studies: Array.isArray(f.project.studies) ? f.project.studies : [], revisions: f.project.revisions.map((r) => ({ ...r, reviews: Array.isArray(r.reviews) ? r.reviews : [] })) }
  const { errors } = await verifyHistory(project)
  return { project: errors.length ? null : project, errors }
}

// ---------- Diffs ----------

export type Change = { domain: string; path: string; kind: 'added' | 'removed' | 'changed'; before?: string; after?: string }

const isQuantity = (v: unknown): v is Quantity => !!v && typeof v === 'object' && 'unit' in v && 'provenance' in v && 'value' in v
const describe = (v: unknown): string => {
  if (v === undefined) return '—'
  if (isQuantity(v)) return (v.value === null ? '—' : String(v.value)) + (v.unit ? ' ' + v.unit : '') + ' · ' + v.provenance + (v.source ? ' · ' + v.source : v.note ? ' · ' + v.note : '')
  const text = typeof v === 'string' ? v : JSON.stringify(v)
  return text.length > 80 ? text.slice(0, 77) + '…' : text
}
/** Arrays of records with an id or name are matched by that key, otherwise by index. */
const keyOf = (item: unknown, index: number) => item && typeof item === 'object' ? String((item as { id?: unknown }).id ?? (item as { name?: unknown }).name ?? index) : String(index)

function diffValue(domain: string, path: string, a: unknown, b: unknown, out: Change[]) {
  if (canonicalJson(a) === canonicalJson(b)) return
  if (a === undefined) { out.push({ domain, path, kind: 'added', after: describe(b) }); return }
  if (b === undefined) { out.push({ domain, path, kind: 'removed', before: describe(a) }); return }
  if (isQuantity(a) || isQuantity(b) || typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) { out.push({ domain, path, kind: 'changed', before: describe(a), after: describe(b) }); return }
  if (Array.isArray(a) && Array.isArray(b)) {
    const ma = new Map(a.map((x, i) => [keyOf(x, i), x])), mb = new Map(b.map((x, i) => [keyOf(x, i), x]))
    for (const k of new Set([...ma.keys(), ...mb.keys()])) diffValue(domain, path + '[' + k + ']', ma.get(k), mb.get(k), out)
    return
  }
  const oa = a as Record<string, unknown>, ob = b as Record<string, unknown>
  for (const k of new Set([...Object.keys(oa), ...Object.keys(ob)])) diffValue(domain, path ? path + ' › ' + k : k, oa[k], ob[k], out)
}

export function diffSnapshots(a: Snapshot, b: Snapshot): Change[] {
  const out: Change[] = []
  for (const { key, label } of WORKSPACE_DOMAINS) diffValue(label, '', a[key], b[key], out)
  return out
}

// ---------- Provenance census and audit ----------

export type Census = { counts: Record<Provenance, number>; total: number; issues: { domain: string; path: string; issue: string }[] }

/** Counts every quantity in a snapshot by provenance and lists under-documented ones. */
export function provenanceCensus(snapshot: Snapshot): Census {
  const counts = Object.fromEntries(PROVENANCES.map((p) => [p, 0])) as Record<Provenance, number>
  const issues: Census['issues'] = []
  const walk = (domain: string, path: string, v: unknown) => {
    if (isQuantity(v)) {
      if (PROVENANCES.includes(v.provenance)) counts[v.provenance]++
      for (const issue of quantityIssues(v, path || 'value')) issues.push({ domain, path, issue })
      return
    }
    if (Array.isArray(v)) v.forEach((x, i) => walk(domain, path + '[' + keyOf(x, i) + ']', x))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(domain, path ? path + ' › ' + k : k, x)
  }
  // Simulation packages hold copies of lab inputs; count the labs themselves to avoid double counting.
  for (const { key, label } of WORKSPACE_DOMAINS) if (key !== 'telaio.simulationJobs.v1') walk(label, '', snapshot[key])
  return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0), issues }
}

/** Sealed simulation packages contained in a snapshot. */
export function packagesIn(snapshot: Snapshot): { name: string; solver: string; sha256: string; createdAt: string }[] {
  const jobs = snapshot['telaio.simulationJobs.v1']
  if (!Array.isArray(jobs)) return []
  return jobs.flatMap((j) => j?.package?.sha256 ? [{ name: j.package.name, solver: j.package.solver?.id + ' ' + j.package.solver?.version, sha256: j.package.sha256, createdAt: j.package.createdAt }] : [])
}

// ---------- User-defined studies ----------

/** Applies study overrides to solver inputs. Paths address quantities, e.g. "inputs.speed" or "vehicle.clA". */
export function applyOverrides(inputs: unknown, overrides: StudyDefinition['overrides']): { inputs: unknown; errors: string[] } {
  const copy = structuredClone(inputs) as Record<string, unknown>
  const errors: string[] = []
  for (const o of overrides) {
    const keys = o.path.split('.')
    let node: unknown = copy
    for (const k of keys.slice(0, -1)) node = node && typeof node === 'object' ? (node as Record<string, unknown>)[k] : undefined
    const last = keys[keys.length - 1]
    const target = node && typeof node === 'object' ? (node as Record<string, unknown>)[last] : undefined
    if (!isQuantity(target)) { errors.push('No quantity at ' + o.path); continue }
    if (!Number.isFinite(o.value)) { errors.push(o.path + ': value must be a number'); continue }
    ;(node as Record<string, unknown>)[last] = { value: o.value, unit: target.unit, provenance: o.provenance, ...(o.provenance === 'SOURCED' ? { source: o.note } : { note: o.note || 'Study override' }) }
  }
  return { inputs: copy, errors }
}

export const PROJECT_STORAGE_KEY = 'telaio.projects.v1'
