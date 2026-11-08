import { describe, expect, it } from 'vitest'
import { illustrativeBrakingInputs, analyseBraking } from '../engineering/braking'
import { illustrativeTrack, illustrativeVehicle } from '../engineering/dynamics'
import { FRONT_HARDPOINTS } from '../model/hardpoints'
import { unknown } from '../engineering/quantity'
import { runSolver, SOLVERS } from './solvers'
import { acceptExternalResults, canonicalJson, createExternalRequest, createPackage, hashOf, verifyPackage, type ExternalResults } from './packages'
import { inputRows, reportHtml, reportMarkdown } from './reports'
import { capJobs, MAX_STORED_JOBS, parseJobs, type Job } from './jobs'

const brakingInput = { inputs: illustrativeBrakingInputs() }

describe('canonical encoding', () => {
  it('ignores key order and undefined values, keeps array order', async () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: undefined } })).toBe('{"a":{"d":[3,1]},"b":1}')
    expect(await hashOf({ x: 1, y: [1, 2] })).toBe(await hashOf({ y: [1, 2], x: 1 }))
    expect(await hashOf({ y: [2, 1] })).not.toBe(await hashOf({ y: [1, 2] }))
  })
})

describe('solvers', () => {
  it('the registry runs the same model as the labs', () => {
    const out = runSolver('braking-study', brakingInput)
    expect(out.summary['Braking distance'].value).toBe(analyseBraking(brakingInput.inputs).brakingDistance.value)
    expect(out.summary['Braking distance'].provenance).toBe('ILLUSTRATIVE')
    expect(out.series.distanceVsSpeed.length).toBeGreaterThan(5)
  })
  it('runs a lap, a sweep and a suspension sweep, reporting progress', () => {
    const progress: number[] = []
    const lap = runSolver('lap-simulation', { vehicle: illustrativeVehicle(), track: illustrativeTrack(), handlingSpeedKmh: 150 }, (f) => progress.push(f))
    expect(lap.summary['Lap time'].value).toBeGreaterThan(20)
    expect(progress.length).toBeGreaterThan(0)
    const sweep = runSolver('lap-parameter-sweep', { vehicle: illustrativeVehicle(), track: illustrativeTrack(), parameter: 'mass', from: 700, to: 900, steps: 5 })
    expect(sweep.summary['Optimum inside range'].value).toBe('no (edge of range)')
    const susp = runSolver('suspension-sweep', { hardpoints: FRONT_HARDPOINTS, provenance: 'ILLUSTRATIVE', springs: { springRate: unknown('N/mm'), rockerRatio: unknown('ratio'), damperCoefficient: unknown('N·s/m'), cornerMass: unknown('kg') }, range: 0.05, steps: 10 })
    expect(susp.summary['Max closure error'].value as number).toBeLessThan(1e-9)
    expect(() => runSolver('nope' as never, {})).toThrow(/Unknown solver/)
  })
})

describe('reproducible packages', () => {
  it('a fresh package is sealed and reproduces exactly, even after JSON round-trip', async () => {
    const pkg = await createPackage('Brake check', 'braking-study', brakingInput, runSolver('braking-study', brakingInput), '2026-11-09T00:00:00Z')
    expect(pkg.sha256).toMatch(/^[0-9a-f]{64}$/)
    const verdict = await verifyPackage(JSON.parse(JSON.stringify(pkg)))
    expect(verdict).toMatchObject({ sealIntact: true, reproduced: true, versionMatches: true, differences: [] })
  })
  it('editing a package breaks the seal', async () => {
    const pkg = await createPackage('x', 'braking-study', brakingInput, runSolver('braking-study', brakingInput))
    const edited = structuredClone(pkg); (edited.outputs.summary['Braking distance'].value as number) *= 0.9
    expect(await verifyPackage(edited)).toMatchObject({ sealIntact: false, reproduced: false })
  })
  it('re-sealing an edited package is still caught, because re-running the solver disagrees', async () => {
    const pkg = await createPackage('x', 'braking-study', brakingInput, runSolver('braking-study', brakingInput))
    const forged = structuredClone(pkg); (forged.outputs.summary['Braking distance'].value as number) *= 0.9
    forged.sha256 = await hashOf({ solver: forged.solver, inputs: forged.inputs, outputs: forged.outputs })
    const verdict = await verifyPackage(forged)
    expect(verdict.sealIntact).toBe(true)
    expect(verdict.reproduced).toBe(false)
    expect(verdict.differences).toContain('Braking distance')
  })
  it('reports a solver-version mismatch alongside the reproduction result', async () => {
    const pkg = await createPackage('x', 'braking-study', brakingInput, runSolver('braking-study', brakingInput))
    const old = { ...structuredClone(pkg), solver: { ...pkg.solver, version: '0.9.0' } }
    old.sha256 = await hashOf({ solver: old.solver, inputs: old.inputs, outputs: old.outputs })
    const verdict = await verifyPackage(old)
    expect(verdict).toMatchObject({ sealIntact: true, versionMatches: false })
    expect(verdict.message).toMatch(/0\.9\.0/)
  })
})

describe('external solver exchange', () => {
  const solver = { name: 'ExampleFEA', version: '2.1', discipline: 'Thermal' as const }
  const results = (requestSha256: string, overrides: Partial<ExternalResults> = {}): ExternalResults => ({ format: 'telaio.external-results', formatVersion: 1, requestSha256, solver, completedAt: '2026-11-09T01:00:00Z', values: { 'Peak rotor temperature': { value: 612.4, unit: '°C' } }, provenance: 'DERIVED', ...overrides })
  it('accepts results only for the exact request, from the named solver, with provenance and units', async () => {
    const pkg = await createPackage('src', 'braking-study', brakingInput, runSolver('braking-study', brakingInput))
    const request = await createExternalRequest(pkg, solver, { mesh: '2 mm tet', convection: 'h = 90 W/m²K' }, 'Rotor transient thermal')
    expect(await acceptExternalResults(request, results(request.sha256))).toEqual({ accepted: true, errors: [] })
    expect((await acceptExternalResults(request, results('f'.repeat(64)))).errors[0]).toMatch(/different request/)
    expect((await acceptExternalResults(request, results(request.sha256, { solver: { ...solver, name: 'Other' } }))).accepted).toBe(false)
    expect((await acceptExternalResults(request, results(request.sha256, { values: { x: { value: 1 } as never } }))).errors[0]).toMatch(/needs a value and a unit/)
    const editedRequest = { ...request, settings: { mesh: '10 mm' } }
    expect((await acceptExternalResults(editedRequest, results(request.sha256))).errors[0]).toMatch(/request itself has been edited/)
  })
})

describe('reports', () => {
  it('lists every quantity input with provenance and source, escapes HTML, and states the hash', async () => {
    const inputs = { inputs: { ...illustrativeBrakingInputs(), mu: { value: 1.7, unit: '–', provenance: 'SOURCED' as const, source: 'Tyre test <rig 3> & "B"' } } }
    const pkg = await createPackage('<script>x</script>', 'braking-study', inputs, runSolver('braking-study', inputs))
    const html = reportHtml(pkg)
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Tyre test &lt;rig 3&gt; &amp; &quot;B&quot;')
    expect(html).toContain(pkg.sha256)
    expect(inputRows(pkg.inputs).filter((r) => r.provenance)).toHaveLength(16)
    const md = reportMarkdown(pkg)
    expect(md).toContain('| inputs.mu | 1.7 | – | SOURCED |')
    expect(md).toContain(pkg.sha256)
  })
})

describe('job store', () => {
  const job = (i: number, status: Job['status'] = 'done'): Job => ({ id: 'j' + i, name: 'J' + i, solver: 'braking-study', inputs: {}, status, progress: 1, createdAt: '' })
  it('marks interrupted jobs failed on reload and drops unknown solvers', () => {
    const parsed = parseJobs(JSON.stringify([job(1, 'running'), job(2, 'queued'), job(3), { ...job(4), solver: 'warp' }]))
    expect(parsed.map((j) => j.status)).toEqual(['failed', 'failed', 'done'])
    expect(parsed[0].error).toMatch(/Interrupted/)
    expect(parseJobs('{bad')).toEqual([])
  })
  it('caps finished jobs but never drops active ones', () => {
    const many = [job(0, 'running'), ...Array.from({ length: 40 }, (_, i) => job(i + 1))]
    const capped = capJobs(many)
    expect(capped).toHaveLength(MAX_STORED_JOBS)
    expect(capped[0].status).toBe('running')
    expect(Object.keys(SOLVERS)).toHaveLength(4)
  })
})
