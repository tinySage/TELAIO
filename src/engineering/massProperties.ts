/**
 * Mass properties of a vehicle configuration: total mass, centre of gravity, axle load split and a
 * point-mass inertia tensor. Positions come from the assembly model in study units; anything in metres
 * needs a study-frame scale (metres per study unit) with its own provenance.
 */
import type { Part, Vec3 } from '../model/components'
import { partAnchor } from '../model/cad'
import { isKnown, parseQuantity, quantityIssues, result, unknown, type Provenance, type Quantity, type Result } from './quantity'

export type BallastItem = { id: string; label: string; mass: Quantity; position: Vec3 }

export type MassConfiguration = {
  id: string
  name: string
  /** Mass per component ID, kg. Absent means UNKNOWN. */
  masses: Record<string, Quantity>
  /** Component IDs deliberately left out of the totals, with the reason recorded as an assumption. */
  excluded: Record<string, string>
  ballast: BallastItem[]
  /** Metres per study unit. */
  scale: Quantity
}

export const newMassConfiguration = (id: string, name: string): MassConfiguration => ({ id, name, masses: {}, excluded: {}, ballast: [], scale: unknown('m/su') })

export type MassReport = {
  totalMass: Result<number>
  cog: Result<Vec3>
  cogMetres: Result<Vec3>
  frontFraction: Result<number>
  inertia: Result<number[][]>
  contributors: number
  missing: string[]
  issues: string[]
  axles: { front: number; rear: number }
}

/** Front and rear axle x positions in the study frame, from the wheel components. */
export function axlePositions(parts: Part[]): { front: number; rear: number } {
  const x = (id: string) => parts.find((part) => part.id === id)?.position[0]
  const front = x('wheel-tyre'), rear = x('rear-left-wheel')
  if (front === undefined || rear === undefined) throw new Error('Axle reference wheels missing from the assembly')
  return { front, rear }
}

/**
 * Computes mass properties for the installed components of a configuration. Results are UNKNOWN while
 * any included component lacks a known mass; the missing list says which.
 */
export function computeMassProperties(config: MassConfiguration, parts: Part[], installedIds: string[]): MassReport {
  const axles = axlePositions(parts)
  const included = parts.filter((part) => installedIds.includes(part.id) && !(part.id in config.excluded))
  const issues: string[] = []
  const items: { label: string; mass: number; position: Vec3; provenance: Provenance }[] = []
  const missing: string[] = []
  for (const part of included) {
    const mass = config.masses[part.id]
    if (mass) issues.push(...quantityIssues(mass, part.name))
    if (!isKnown(mass)) { missing.push(part.id); continue }
    if (mass.value < 0) { issues.push(part.name + ': negative mass'); missing.push(part.id); continue }
    items.push({ label: part.name, mass: mass.value, position: partAnchor(part, 0), provenance: mass.provenance })
  }
  for (const item of config.ballast) {
    issues.push(...quantityIssues(item.mass, 'Ballast ' + item.label))
    if (!isKnown(item.mass) || item.mass.value < 0) { missing.push('ballast:' + item.id); continue }
    items.push({ label: 'Ballast ' + item.label, mass: item.mass.value, position: item.position, provenance: item.mass.provenance })
  }

  const assumptions = ['Each component is a point mass at its study-frame anchor; component CoG offsets are not modelled']
  const excludedEntries = Object.entries(config.excluded).filter(([id]) => installedIds.includes(id))
  if (excludedEntries.length) {
    const byReason = new Map<string, string[]>()
    for (const [id, reason] of excludedEntries) byReason.set(reason.trim() || 'no reason given', [...(byReason.get(reason.trim() || 'no reason given') ?? []), id])
    const groups = [...byReason].map(([reason, ids]) => ids.length <= 3 ? ids.map((id) => id + ' (' + reason + ')').join(', ') : ids.length + ' components (' + reason + ')')
    assumptions.push(excludedEntries.length + ' installed component(s) excluded from totals: ' + groups.join('; '))
  }
  const provenances = items.map((item) => item.provenance)
  const total = items.reduce((sum, item) => sum + item.mass, 0)
  const computable = missing.length === 0 && items.length > 0 && total > 0
  const cogValue: Vec3 | null = computable ? [0, 1, 2].map((axis) => items.reduce((sum, item) => sum + item.mass * item.position[axis], 0) / total) as Vec3 : null

  const totalMass = result(computable ? total : null, 'kg', provenances, missing, assumptions)
  const cog = result(cogValue, 'su', provenances, missing, assumptions)
  const frontFraction = result(cogValue ? (cogValue[0] - axles.rear) / (axles.front - axles.rear) : null, 'fraction', provenances, missing,
    [...assumptions, 'Static axle split from CoG position between axle lines; independent of the study-frame scale'])

  const scaleKnown = isKnown(config.scale) && config.scale.value > 0
  if (isKnown(config.scale)) issues.push(...quantityIssues(config.scale, 'Study-frame scale'))
  const scaleMissing = scaleKnown ? [] : ['scale']
  const scale = scaleKnown ? config.scale.value! : 0
  const scaledInputs = scaleKnown ? [...provenances, config.scale.provenance] : provenances
  const cogMetres = result(cogValue && scaleKnown ? cogValue.map((value) => value * scale) as Vec3 : null, 'm', scaledInputs, [...missing, ...scaleMissing], assumptions)

  let inertiaValue: number[][] | null = null
  if (cogValue && scaleKnown) {
    inertiaValue = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    for (const item of items) {
      const r = [0, 1, 2].map((axis) => (item.position[axis] - cogValue[axis]) * scale)
      const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2]
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) inertiaValue[i][j] += item.mass * ((i === j ? r2 : 0) - r[i] * r[j])
    }
  }
  const inertia = result(inertiaValue, 'kg·m²', scaledInputs, [...missing, ...scaleMissing], [...assumptions, 'Inertia about the CoG in the study frame axes; point masses only, so each component’s own inertia is omitted and the tensor is a lower bound'])
  return { totalMass, cog, cogMetres, frontFraction, inertia, contributors: items.length, missing, issues, axles }
}

export type MassComparison = { deltaMass: number | null; deltaCog: Vec3 | null; deltaFrontFraction: number | null; provenance: Provenance }

/** Differences B − A, available only where both results are known. */
export function compareMassReports(a: MassReport, b: MassReport): MassComparison {
  const both = <T,>(x: Result<T>, y: Result<T>) => x.value !== null && y.value !== null
  return {
    deltaMass: both(a.totalMass, b.totalMass) ? b.totalMass.value! - a.totalMass.value! : null,
    deltaCog: both(a.cog, b.cog) ? [0, 1, 2].map((axis) => b.cog.value![axis] - a.cog.value![axis]) as Vec3 : null,
    deltaFrontFraction: both(a.frontFraction, b.frontFraction) ? b.frontFraction.value! - a.frontFraction.value! : null,
    provenance: [a.totalMass.provenance, b.totalMass.provenance].includes('UNKNOWN') ? 'UNKNOWN' : result(0, '', [a.totalMass.provenance, b.totalMass.provenance]).provenance,
  }
}

/**
 * Ballast mass at study-frame x needed to move the front axle fraction to `target`, holding everything
 * else fixed. Returns null when the target is unreachable with ballast at that position.
 */
export function ballastForTarget(report: MassReport, x: number, target: number): number | null {
  if (report.totalMass.value === null || report.cog.value === null) return null
  const { front, rear } = report.axles
  const targetX = rear + target * (front - rear)
  const m = report.totalMass.value, cx = report.cog.value[0]
  if (Math.abs(x - targetX) < 1e-12) return null
  const added = m * (targetX - cx) / (x - targetX)
  return added >= 0 ? added : null
}

export const MASS_CONFIG_STORAGE_KEY = 'telaio.massConfigurations.v1'

/** Parses stored configurations, dropping malformed entries and unknown component IDs. */
export function parseMassConfigurations(raw: string | null, knownIds: Set<string>): { configurations: MassConfiguration[]; warnings: string[] } {
  if (!raw) return { configurations: [], warnings: [] }
  let value: unknown
  try { value = JSON.parse(raw) } catch { return { configurations: [], warnings: ['Stored mass configurations could not be read'] } }
  if (!Array.isArray(value)) return { configurations: [], warnings: ['Stored mass configurations had an unexpected format'] }
  const warnings: string[] = []
  const configurations: MassConfiguration[] = []
  for (const entry of value) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string') { warnings.push('Skipped a malformed mass configuration'); continue }
    const masses: Record<string, Quantity> = {}
    for (const [id, q] of Object.entries(entry.masses ?? {})) { if (knownIds.has(id)) masses[id] = parseQuantity(q, 'kg'); else warnings.push(`"${entry.name}": dropped mass for unknown component ${id}`) }
    const excluded: Record<string, string> = {}
    for (const [id, reason] of Object.entries(entry.excluded ?? {})) if (knownIds.has(id)) excluded[id] = String(reason ?? '')
    const ballast: BallastItem[] = Array.isArray(entry.ballast) ? entry.ballast.filter((item: BallastItem) => item && typeof item.id === 'string' && Array.isArray(item.position) && item.position.length === 3 && item.position.every(Number.isFinite))
      .map((item: BallastItem) => ({ id: item.id, label: String(item.label ?? item.id), mass: parseQuantity(item.mass, 'kg'), position: item.position })) : []
    configurations.push({ id: entry.id, name: entry.name, masses, excluded, ballast, scale: parseQuantity(entry.scale, 'm/su') })
  }
  return { configurations, warnings }
}

/**
 * Opt-in demonstration data: round numbers to exercise the engine. Explicitly ILLUSTRATIVE and not
 * SF-24 or any real car's data. Components without a demo value are excluded with that reason.
 */
export function illustrativeDemoConfiguration(parts: Part[], id: string): MassConfiguration {
  const note = 'Round demonstration value; not SF-24 or any real vehicle data'
  const demo: Record<string, number> = {
    'chassis-node': 60, 'engine': 150, 'gearbox': 40, 'differential': 8, 'floor-reference': 12, 'diffuser': 4, 'nose-reference': 8, 'front-wing-reference': 6,
    'rear-wing-reference': 8, 'sidepod-left': 4, 'sidepod-right': 4, 'engine-cover-reference': 5, 'radiator-left': 7, 'radiator-right': 7, 'halo': 7,
    'wheel-tyre': 12, 'front-right-wheel': 12, 'rear-left-wheel': 14, 'rear-right-wheel': 14, 'front-upright': 3, 'front-right-upright': 3, 'rear-upright': 3, 'rear-right-upright': 3,
    'steering-rack': 3, 'master-cylinder-front': 1, 'master-cylinder-rear': 1, 'front-bulkhead': 3, 'roll-hoop': 3, 'driveshaft-left': 3, 'driveshaft-right': 3,
  }
  const masses: Record<string, Quantity> = {}
  const excluded: Record<string, string> = {}
  for (const part of parts) {
    if (part.id in demo) masses[part.id] = { value: demo[part.id], unit: 'kg', provenance: 'ILLUSTRATIVE', note }
    else excluded[part.id] = 'no demo value'
  }
  return {
    id, name: 'Illustrative demo (not real data)', masses, excluded,
    ballast: [{ id: 'demo-ballast', label: 'Floor ballast', mass: { value: 10, unit: 'kg', provenance: 'ILLUSTRATIVE', note }, position: [0.3, -0.27, 0] }],
    scale: { value: 3.6 / 2.12, unit: 'm/su', provenance: 'ILLUSTRATIVE', note: 'Assumes a 3.6 m wheelbase over the 2.12 su study wheelbase; demonstration only' },
  }
}
