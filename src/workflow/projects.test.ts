import { describe, expect, it } from 'vitest'
import { parts } from '../model/components'
import { interfaces, installPrerequisites } from '../model/assembly'
import { illustrativeBrakingInputs } from '../engineering/braking'
import { projectReportHtml } from './projectReport'
import { applyOverrides, assemblyFingerprint, captureWorkspace, commitRevision, diffSnapshots, exportProject, importProject, packagesIn, provenanceCensus, restoreWorkspace, verifyHistory, WORKSPACE_DOMAINS, type Project, type WorkspaceStore } from './projects'

function memoryStore(initial: Record<string, unknown> = {}): WorkspaceStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]))
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) }
}
const context = { assembly: 'a'.repeat(64), assets: {} }
const project = (): Project => ({ id: 'p1', name: 'Test', description: '', createdAt: '2026-11-09T00:00:00Z', revisions: [], studies: [] })

describe('workspace snapshots', () => {
  it('captures only engineering domains and restores them exactly, clearing absent ones', () => {
    const store = memoryStore({ 'telaio.brakingInputs.v1': illustrativeBrakingInputs(), 'telaio.aero.v1': { front: 30 }, 'unrelated.key': 1 })
    const snap = captureWorkspace(store)
    expect(Object.keys(snap).sort()).toEqual(['telaio.aero.v1', 'telaio.brakingInputs.v1'])
    const other = memoryStore({ 'telaio.dynamics.v1': { a: 1 } })
    restoreWorkspace(other, snap)
    expect(other.data.has('telaio.dynamics.v1')).toBe(false)
    expect(JSON.parse(other.get('telaio.aero.v1')!)).toEqual({ front: 30 })
    expect(WORKSPACE_DOMAINS).toHaveLength(9)
  })
})

describe('revision history', () => {
  it('chains sealed revisions, and an edited revision or broken chain is detected', async () => {
    const p = project()
    p.revisions.push(await commitRevision(p, { 'telaio.aero.v1': { front: 30 } }, 'First', 'Momo', context))
    p.revisions.push(await commitRevision(p, { 'telaio.aero.v1': { front: 35 } }, 'Lower nose', 'Momo', context))
    expect(p.revisions[1].parentId).toBe(p.revisions[0].id)
    expect(await verifyHistory(p)).toEqual({ valid: true, errors: [] })
    const edited = structuredClone(p); (edited.revisions[0].snapshot['telaio.aero.v1'] as { front: number }).front = 99
    expect((await verifyHistory(edited)).errors[0]).toMatch(/seal broken/)
    const reordered = { ...structuredClone(p), revisions: [...p.revisions].reverse() }
    expect((await verifyHistory(reordered)).valid).toBe(false)
  })

  it('review notes are annotations outside the seal', async () => {
    const p = project()
    p.revisions.push(await commitRevision(p, {}, 'Empty', 'Momo', context))
    p.revisions[0].reviews.push({ reviewer: 'Supervisor', verdict: 'approved', comment: 'OK', at: '' })
    expect((await verifyHistory(p)).valid).toBe(true)
  })

  it('exports and imports a project file, rejecting tampered files', async () => {
    const p = project()
    p.revisions.push(await commitRevision(p, { 'telaio.brakingInputs.v1': illustrativeBrakingInputs() }, 'Baseline', 'Momo', context))
    const file = JSON.parse(JSON.stringify(exportProject(p)))
    expect((await importProject(file)).project?.revisions[0].sha256).toBe(p.revisions[0].sha256)
    file.project.revisions[0].message = 'Rewritten history'
    expect((await importProject(file)).errors[0]).toMatch(/seal broken/)
    expect((await importProject({ hello: 1 })).errors).toEqual(['Not a TELAIO project file'])
  })

  it('fingerprints the assembly model, and the fingerprint changes when the model does', async () => {
    const a = await assemblyFingerprint(), b = await assemblyFingerprint()
    expect(a).toBe(b)
    const moved = parts.map((p) => p.id === 'brake-disc' ? { ...p, position: [0, 0, 0] as [number, number, number] } : p)
    expect(await assemblyFingerprint({ parts: moved, interfaces, installPrerequisites })).not.toBe(a)
  })
})

describe('diffs', () => {
  it('reports quantity value and provenance changes, and additions matched by id', () => {
    const before = { 'telaio.brakingInputs.v1': illustrativeBrakingInputs(), 'telaio.massConfigurations.v1': [{ id: 'm1', name: 'Base' }] }
    const after = structuredClone(before) as typeof before
    after['telaio.brakingInputs.v1'].mass = { value: 795, unit: 'kg', provenance: 'SOURCED', source: 'Scales, 9 Nov' }
    ;(after['telaio.massConfigurations.v1'] as unknown[]).push({ id: 'm2', name: 'Light' })
    const changes = diffSnapshots(before, after)
    expect(changes).toContainEqual({ domain: 'Braking inputs', path: 'mass', kind: 'changed', before: expect.stringMatching(/^800 kg · ILLUSTRATIVE/), after: '795 kg · SOURCED · Scales, 9 Nov' })
    expect(changes).toContainEqual(expect.objectContaining({ domain: 'Mass properties', path: '[m2]', kind: 'added' }))
    expect(changes).toHaveLength(2)
    expect(diffSnapshots(before, structuredClone(before))).toEqual([])
  })
})

describe('provenance census and audit', () => {
  it('counts quantities by label and lists under-documented ones', () => {
    const inputs = illustrativeBrakingInputs()
    inputs.mu = { value: 1.7, unit: '–', provenance: 'SOURCED' }
    inputs.speed = { value: 250, unit: 'km/h', provenance: 'ESTIMATED' }
    const census = provenanceCensus({ 'telaio.brakingInputs.v1': inputs })
    expect(census.total).toBe(16)
    expect(census.counts).toMatchObject({ ILLUSTRATIVE: 14, SOURCED: 1, ESTIMATED: 1 })
    expect(census.issues.map((i) => i.path).sort()).toEqual(['mu', 'speed'])
  })
  it('lists sealed packages in a snapshot', () => {
    expect(packagesIn({ 'telaio.simulationJobs.v1': [{ package: { name: 'A', solver: { id: 'braking-study', version: '1.0.0' }, sha256: 'x', createdAt: '' } }, { status: 'failed' }] })).toHaveLength(1)
  })
})

describe('user-defined studies', () => {
  it('overrides quantities by path with the stated provenance, and reports bad paths', () => {
    const base = { inputs: illustrativeBrakingInputs() }
    const { inputs, errors } = applyOverrides(base, [{ path: 'inputs.speed', value: 250, provenance: 'ESTIMATED', note: 'Qualifying entry speed' }, { path: 'inputs.warp', value: 1, provenance: 'ESTIMATED', note: '' }])
    expect((inputs as typeof base).inputs.speed).toMatchObject({ value: 250, unit: 'km/h', provenance: 'ESTIMATED', note: 'Qualifying entry speed' })
    expect(base.inputs.speed.value).toBe(300)
    expect(errors).toEqual(['No quantity at inputs.warp'])
  })
})

describe('project report', () => {
  it('escapes content and states the revision hash, census and changes', async () => {
    const p = { ...project(), name: '<b>Car</b>' }
    p.revisions.push(await commitRevision(p, { 'telaio.brakingInputs.v1': illustrativeBrakingInputs() }, 'Baseline', 'Momo', context))
    const r = p.revisions[0]
    const html = projectReportHtml(p, r, provenanceCensus(r.snapshot), diffSnapshots({}, r.snapshot), [], false)
    expect(html).toContain('&lt;b&gt;Car&lt;/b&gt;')
    expect(html).toContain(r.sha256)
    expect(html).toContain('16 quantities')
    expect(html).toContain('different assembly model')
  })
})
