/**
 * Reproducible simulation packages and the external-solver exchange format.
 *
 * A package seals solver id/version, inputs and outputs with a SHA-256 over a canonical JSON encoding
 * (sorted keys), so the same content always gives the same hash. Verification is two-step: the seal
 * detects edits to the file; re-running the solver detects outputs that the model no longer produces.
 *
 * External solvers (FEA, CFD, thermal) are not run by TELAIO. A request package carries a source
 * package's hash and the solver settings; a results package is accepted only if it names that exact
 * request hash, and its values are labelled as computed externally by the named solver.
 */
import { sha256Hex } from '../model/assetChecks'
import { runSolver, SOLVERS, type SolverId, type SolverOutput } from './solvers'
import { PROVENANCES, type Provenance } from '../engineering/quantity'

export const PACKAGE_FORMAT = 'telaio.simulation-package'
export const PACKAGE_FORMAT_VERSION = 1

/** JSON with object keys sorted recursively; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonicalJson(v)).join(',') + '}'
}

export const hashOf = (value: unknown) => sha256Hex(new TextEncoder().encode(canonicalJson(value)))

export type SimulationPackage = {
  format: typeof PACKAGE_FORMAT; formatVersion: number
  name: string; createdAt: string
  solver: { id: SolverId; version: string }
  inputs: unknown; outputs: SolverOutput
  /** SHA-256 of canonicalJson({ solver, inputs, outputs }). */
  sha256: string
}

const sealed = (p: Pick<SimulationPackage, 'solver' | 'inputs' | 'outputs'>) => ({ solver: p.solver, inputs: p.inputs, outputs: p.outputs })

export async function createPackage(name: string, solverId: SolverId, inputs: unknown, outputs: SolverOutput, createdAt = new Date().toISOString()): Promise<SimulationPackage> {
  const solver = { id: solverId, version: SOLVERS[solverId].version }
  return { format: PACKAGE_FORMAT, formatVersion: PACKAGE_FORMAT_VERSION, name, createdAt, solver, inputs, outputs, sha256: await hashOf(sealed({ solver, inputs, outputs })) }
}

export type PackageVerdict = { sealIntact: boolean; solverAvailable: boolean; versionMatches: boolean; reproduced: boolean; differences: string[]; message: string }

/** Checks the seal, then re-runs the solver and compares every output to 1e-9 relative. */
export async function verifyPackage(pkg: SimulationPackage): Promise<PackageVerdict> {
  const base = { sealIntact: false, solverAvailable: false, versionMatches: false, reproduced: false, differences: [] as string[] }
  if (pkg?.format !== PACKAGE_FORMAT || typeof pkg.sha256 !== 'string') return { ...base, message: 'Not a TELAIO simulation package' }
  const sealIntact = (await hashOf(sealed(pkg))) === pkg.sha256
  if (!sealIntact) return { ...base, message: 'Seal broken: the file was edited after it was created (SHA-256 mismatch)' }
  const solver = SOLVERS[pkg.solver?.id as SolverId]
  if (!solver) return { ...base, sealIntact, message: 'Seal intact, but this build has no solver "' + pkg.solver?.id + '"' }
  const versionMatches = solver.version === pkg.solver.version
  const rerun = runSolver(pkg.solver.id, pkg.inputs)
  const differences: string[] = []
  const close = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)) : a === b
  for (const key of new Set([...Object.keys(rerun.summary), ...Object.keys(pkg.outputs.summary)])) {
    const a = pkg.outputs.summary[key], b = rerun.summary[key]
    if (!a || !b || !close(a.value, b.value) || a.provenance !== b.provenance) differences.push(key)
  }
  for (const key of new Set([...Object.keys(rerun.series), ...Object.keys(pkg.outputs.series)])) {
    const a = pkg.outputs.series[key] ?? [], b = rerun.series[key] ?? []
    if (a.length !== b.length || a.some((v, i) => !close(v, b[i]))) differences.push('series ' + key)
  }
  const reproduced = differences.length === 0
  const message = reproduced
    ? `Seal intact and reproduced exactly by ${solver.id} ${solver.version}` + (versionMatches ? '' : ` (package made with ${pkg.solver.version})`)
    : `Seal intact, but re-running ${solver.id} ${solver.version} differs on ${differences.length} output(s)` + (versionMatches ? '' : ` — the package was made with ${pkg.solver.version}`)
  return { sealIntact, solverAvailable: true, versionMatches, reproduced, differences, message }
}

export type ExternalSolver = { name: string; version: string; discipline: 'FEA' | 'CFD' | 'Thermal' | 'Other' }

export type ExternalRequest = {
  format: 'telaio.external-request'; formatVersion: 1; createdAt: string
  solver: ExternalSolver
  /** Free-form solver configuration recorded verbatim (mesh size, boundary conditions, load cases…). */
  settings: Record<string, unknown>
  /** The TELAIO package this request was derived from, by hash, plus its content. */
  source: SimulationPackage
  description: string
  sha256: string
}

export type ExternalResults = {
  format: 'telaio.external-results'; formatVersion: 1
  requestSha256: string
  solver: ExternalSolver
  completedAt: string
  /** Results as reported by the external solver. */
  values: Record<string, { value: number | string; unit: string }>
  /** Provenance the engineer assigns to these results (e.g. DERIVED for a validated solver run). */
  provenance: Provenance
  notes?: string
}

export async function createExternalRequest(source: SimulationPackage, solver: ExternalSolver, settings: Record<string, unknown>, description: string, createdAt = new Date().toISOString()): Promise<ExternalRequest> {
  const body = { format: 'telaio.external-request' as const, formatVersion: 1 as const, createdAt, solver, settings, source, description }
  return { ...body, sha256: await hashOf(body) }
}

/** Accepts external results only for the exact request, with a declared provenance and numeric/string values. */
export async function acceptExternalResults(request: ExternalRequest, results: ExternalResults): Promise<{ accepted: boolean; errors: string[] }> {
  const errors: string[] = []
  if (results?.format !== 'telaio.external-results') errors.push('Not a TELAIO external results file')
  else {
    const { sha256, ...body } = request
    if ((await hashOf(body)) !== sha256) errors.push('The request itself has been edited (SHA-256 mismatch)')
    if (results.requestSha256 !== request.sha256) errors.push('Results reference a different request (hash ' + String(results.requestSha256).slice(0, 12) + '…)')
    if (results.solver?.name !== request.solver.name) errors.push('Results come from "' + results.solver?.name + '", but the request was for "' + request.solver.name + '"')
    if (!PROVENANCES.includes(results.provenance)) errors.push('Results need a provenance label')
    if (!results.values || Object.keys(results.values).length === 0) errors.push('Results contain no values')
    else for (const [k, v] of Object.entries(results.values)) if (!v || (typeof v.value !== 'number' && typeof v.value !== 'string') || typeof v.unit !== 'string') errors.push('Value "' + k + '" needs a value and a unit')
  }
  return { accepted: errors.length === 0, errors }
}
