/**
 * Aerodynamics laboratory: analytical forces from coefficient data. The coefficient source is an aero
 * map — ClA, CdA and aero balance tabulated against front and rear ride height, as supplied by a wind
 * tunnel, CFD campaign or other documented source — plus optional wing-configuration deltas.
 *
 * This module does not compute flow. Coefficients are inputs with provenance; TELAIO interpolates them
 * (bilinear, clamped at the map edge with a warning, never extrapolated) and applies F = ½ρv²·CA.
 */
import { derivedProvenance, isKnown, result, type Provenance, type Quantity, type Result } from './quantity'

export type AeroMap = {
  name: string
  /** Ride heights in mm, strictly increasing. */
  frontRideHeights: number[]
  rearRideHeights: number[]
  /** Grids indexed [front][rear]. */
  clA: number[][]
  cdA: number[][]
  /** Front share of total downforce, 0–1. */
  balance: number[][]
  provenance: Provenance
  source?: string
  note?: string
}

export type WingConfiguration = { id: string; name: string; dClA: number; dCdA: number; dBalance: number; provenance: Provenance; note?: string }

export function validateAeroMap(map: AeroMap): string[] {
  const errors: string[] = []
  const axis = (values: number[], label: string) => {
    if (values.length < 2) errors.push(label + ' needs at least two ride heights')
    if (values.some((v) => !Number.isFinite(v))) errors.push(label + ' ride heights must be numbers')
    for (let i = 1; i < values.length; i++) if (!(values[i] > values[i - 1])) { errors.push(label + ' ride heights must increase strictly'); break }
  }
  axis(map.frontRideHeights, 'Front'); axis(map.rearRideHeights, 'Rear')
  for (const [grid, label] of [[map.clA, 'ClA'], [map.cdA, 'CdA'], [map.balance, 'Balance']] as const) {
    if (grid.length !== map.frontRideHeights.length || grid.some((row) => row.length !== map.rearRideHeights.length)) errors.push(label + ' grid must be ' + map.frontRideHeights.length + ' × ' + map.rearRideHeights.length)
    else if (grid.some((row) => row.some((v) => !Number.isFinite(v)))) errors.push(label + ' grid has missing or non-numeric values')
  }
  if (map.cdA.flat().some((v) => v < 0)) errors.push('CdA must not be negative')
  if (map.balance.flat().some((v) => v < 0 || v > 1)) errors.push('Balance must be between 0 and 1')
  if (map.provenance === 'SOURCED' && !map.source?.trim()) errors.push('A SOURCED map needs a source record')
  return errors
}

/** Bilinear lookup; positions outside the map are clamped to its edge and reported. */
export function interpolate(map: AeroMap, grid: number[][], front: number, rear: number): { value: number; clamped: boolean } {
  const locate = (axis: number[], x: number) => {
    const clamped = x < axis[0] || x > axis[axis.length - 1]
    const xc = Math.min(axis[axis.length - 1], Math.max(axis[0], x))
    let i = 0
    while (i < axis.length - 2 && xc > axis[i + 1]) i++
    return { i, t: (xc - axis[i]) / (axis[i + 1] - axis[i]), clamped }
  }
  const f = locate(map.frontRideHeights, front), r = locate(map.rearRideHeights, rear)
  const v = (fi: number, ri: number) => grid[fi][ri]
  const value = (1 - f.t) * ((1 - r.t) * v(f.i, r.i) + r.t * v(f.i, r.i + 1)) + f.t * ((1 - r.t) * v(f.i + 1, r.i) + r.t * v(f.i + 1, r.i + 1))
  return { value, clamped: f.clamped || r.clamped }
}

export type Coefficients = { clA: number; cdA: number; balance: number; clamped: boolean; provenance: Provenance }

/** Map coefficients at a ride-height pair, plus an optional wing configuration's deltas. */
export function coefficientsAt(map: AeroMap, front: number, rear: number, wing?: WingConfiguration | null): Coefficients {
  const cl = interpolate(map, map.clA, front, rear), cd = interpolate(map, map.cdA, front, rear), b = interpolate(map, map.balance, front, rear)
  const provenance = derivedProvenance(wing ? [map.provenance, wing.provenance] : [map.provenance])
  const clA = cl.value + (wing?.dClA ?? 0)
  // Balance delta shifts the front share of the combined downforce.
  const balance = Math.min(1, Math.max(0, b.value + (wing?.dBalance ?? 0)))
  return { clA, cdA: cd.value + (wing?.dCdA ?? 0), balance, clamped: cl.clamped || cd.clamped || b.clamped, provenance }
}

export type AeroReport = {
  coefficients: Coefficients
  downforce: Result<number>; drag: Result<number>; frontDownforce: Result<number>; rearDownforce: Result<number>
  liftToDrag: Result<number>; dragPower: Result<number>
  /** Centre of pressure measured forward from the rear axle, as a fraction of wheelbase and in metres. */
  copFraction: Result<number>; copFromRearAxle: Result<number>
  sensitivity: { dClA_dFront: number; dClA_dRear: number; dBalance_dPitch: number }
  warnings: string[]
}

export type AeroInputs = { airDensity: Quantity; speed: Quantity; wheelbase: Quantity; frontRideHeight: number; rearRideHeight: number }

export function analyseAero(map: AeroMap, inputs: AeroInputs, wing?: WingConfiguration | null): AeroReport {
  const c = coefficientsAt(map, inputs.frontRideHeight, inputs.rearRideHeight, wing)
  const warnings = c.clamped ? ['Ride height outside the map: coefficients clamped to the map edge, not extrapolated'] : []
  const assumptions = ['Forces = ½ρv²·(coefficient × area) from the aero map; steady, straight-line, no yaw or roll', 'Coefficients interpolated bilinearly between map points']
  const missing = [...(isKnown(inputs.airDensity) ? [] : ['airDensity']), ...(isKnown(inputs.speed) ? [] : ['speed'])]
  const provs = [c.provenance, inputs.airDensity.provenance, inputs.speed.provenance]
  const q = missing.length ? null : 0.5 * inputs.airDensity.value! * (inputs.speed.value! / 3.6) ** 2
  const r = (value: number | null, unit: string, more: string[] = [], extraMissing: string[] = [], extraProv: Provenance[] = []) => result(value, unit, [...provs, ...extraProv], [...missing, ...extraMissing], [...assumptions, ...more])
  const downforce = q === null ? null : q * c.clA, drag = q === null ? null : q * c.cdA
  const copFraction = result(c.balance, 'fraction', [c.provenance], [], ['Centre of pressure from the front share of downforce: x = rear axle + balance × wheelbase'])
  const wb = isKnown(inputs.wheelbase) ? inputs.wheelbase.value : null
  const step = 1
  const at = (df: number, dr: number) => coefficientsAt(map, inputs.frontRideHeight + df, inputs.rearRideHeight + dr, wing)
  return {
    coefficients: c,
    downforce: r(downforce, 'N'), drag: r(drag, 'N'),
    frontDownforce: r(downforce === null ? null : downforce * c.balance, 'N'), rearDownforce: r(downforce === null ? null : downforce * (1 - c.balance), 'N'),
    liftToDrag: result(c.cdA > 0 ? c.clA / c.cdA : null, 'ratio', [c.provenance], c.cdA > 0 ? [] : ['CdA > 0'], assumptions),
    dragPower: r(drag === null ? null : drag * inputs.speed.value! / 3.6, 'W'),
    copFraction,
    copFromRearAxle: result(wb === null ? null : c.balance * wb, 'm', [c.provenance, inputs.wheelbase.provenance], wb === null ? ['wheelbase'] : [], copFraction.assumptions),
    sensitivity: {
      dClA_dFront: (at(step, 0).clA - at(-step, 0).clA) / (2 * step),
      dClA_dRear: (at(0, step).clA - at(0, -step).clA) / (2 * step),
      // Pitch: front down, rear up, by the same amount.
      dBalance_dPitch: (at(-step, step).balance - at(step, -step).balance) / (2 * step),
    },
    warnings,
  }
}

/** ClA and balance as the whole car lowers uniformly by `drop` mm from the given ride heights. */
export function groundEffectSweep(map: AeroMap, front: number, rear: number, wing?: WingConfiguration | null, steps = 41) {
  const lo = Math.min(...map.frontRideHeights) - front, hi = Math.max(...map.frontRideHeights) - front
  const offsets = Array.from({ length: steps }, (_, i) => lo + (hi - lo) * i / (steps - 1))
  const points = offsets.map((o) => coefficientsAt(map, front + o, rear + o, wing))
  const peak = points.reduce((best, p, i) => p.clA > points[best].clA ? i : best, 0)
  return { frontRideHeight: offsets.map((o) => front + o), clA: points.map((p) => p.clA), balance: points.map((p) => p.balance), peakAtFront: front + offsets[peak] }
}

/** Parses long-format CSV: front_mm, rear_mm, ClA, CdA, balance (header optional). Every grid node must be present once. */
export function parseAeroMapCsv(text: string, meta: Pick<AeroMap, 'name' | 'provenance' | 'source' | 'note'>): { map: AeroMap | null; errors: string[] } {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  const errors: string[] = []
  const data: number[][] = []
  rows.forEach((line, index) => {
    const cells = line.split(/[,;\t]/).map((c) => c.trim())
    if (index === 0 && cells.some((c) => Number.isNaN(Number(c)))) return // header
    const values = cells.map(Number)
    if (values.length < 5 || values.slice(0, 5).some((v) => !Number.isFinite(v))) errors.push('Line ' + (index + 1) + ': expected five numbers (front_mm, rear_mm, ClA, CdA, balance)')
    else data.push(values.slice(0, 5))
  })
  if (errors.length) return { map: null, errors }
  const fronts = [...new Set(data.map((d) => d[0]))].sort((a, b) => a - b), rears = [...new Set(data.map((d) => d[1]))].sort((a, b) => a - b)
  const grid = () => fronts.map(() => rears.map(() => NaN))
  const map: AeroMap = { ...meta, frontRideHeights: fronts, rearRideHeights: rears, clA: grid(), cdA: grid(), balance: grid() }
  for (const [f, r, cl, cd, b] of data) {
    const i = fronts.indexOf(f), j = rears.indexOf(r)
    if (!Number.isNaN(map.clA[i][j])) errors.push(`Duplicate point at front ${f} mm, rear ${r} mm`)
    map.clA[i][j] = cl; map.cdA[i][j] = cd; map.balance[i][j] = b
  }
  map.clA.forEach((row, i) => row.forEach((v, j) => { if (Number.isNaN(v)) errors.push(`Missing point at front ${fronts[i]} mm, rear ${rears[j]} mm`) }))
  errors.push(...validateAeroMap(map).filter((e) => !e.includes('missing or non-numeric')))
  return { map: errors.length ? null : map, errors }
}

export function aeroMapToCsv(map: AeroMap): string {
  const lines = ['front_mm,rear_mm,ClA_m2,CdA_m2,balance_front']
  map.frontRideHeights.forEach((f, i) => map.rearRideHeights.forEach((r, j) => lines.push([f, r, map.clA[i][j], map.cdA[i][j], map.balance[i][j]].join(','))))
  return lines.join('\n')
}

/**
 * Opt-in demonstration map with a plausible shape (downforce rising as the car lowers, then stalling;
 * balance moving forward as the front drops). ILLUSTRATIVE: generated by formula, not measured.
 */
export function illustrativeAeroMap(): AeroMap {
  const fronts = [10, 20, 30, 40, 50, 60], rears = [40, 60, 80, 100, 120]
  const clA = (f: number, r: number) => {
    const height = 0.5 * f + 0.5 * r * 0.6, rake = (r - f) / 100
    const stall = height < 28 ? (28 - height) * 0.09 : 0
    return +(4.2 - 0.018 * (height - 28) ** 2 / 10 - stall + 0.4 * rake).toFixed(3)
  }
  return {
    name: 'Illustrative demo map (formula, not measured)', frontRideHeights: fronts, rearRideHeights: rears,
    clA: fronts.map((f) => rears.map((r) => clA(f, r))),
    cdA: fronts.map((f) => rears.map((r) => +(1.05 + 0.04 * clA(f, r)).toFixed(3))),
    balance: fronts.map((f) => rears.map((r) => +(0.44 - 0.0012 * (f - 30) + 0.0006 * (r - 80)).toFixed(4))),
    provenance: 'ILLUSTRATIVE', note: 'Generated by formula to exercise the lab; not wind-tunnel, CFD or SF-24 data',
  }
}

export const illustrativeWingConfigurations = (): WingConfiguration[] => [
  { id: 'baseline', name: 'Baseline wings', dClA: 0, dCdA: 0, dBalance: 0, provenance: 'ILLUSTRATIVE', note: 'Reference level' },
  { id: 'low-drag', name: 'Low-drag rear wing', dClA: -0.6, dCdA: -0.18, dBalance: 0.04, provenance: 'ILLUSTRATIVE', note: 'Demonstration deltas, not measured' },
  { id: 'high-df', name: 'High-downforce rear wing', dClA: 0.5, dCdA: 0.15, dBalance: -0.035, provenance: 'ILLUSTRATIVE', note: 'Demonstration deltas, not measured' },
]

/** Quantities to hand to the braking lab: coefficients at the chosen ride heights, with the map's provenance. */
export function aeroForBraking(map: AeroMap, front: number, rear: number, wing?: WingConfiguration | null): { clA: Quantity; cdA: Quantity; aeroBalance: Quantity } {
  const c = coefficientsAt(map, front, rear, wing)
  const detail = (what: string) => c.provenance === 'SOURCED' || c.provenance === 'DERIVED' ? { source: `${what} from aero map "${map.name}" at ${front}/${rear} mm` } : { note: `${what} from aero map "${map.name}" at ${front}/${rear} mm` + (wing ? ` with ${wing.name}` : '') }
  const prov: Provenance = c.provenance === 'SOURCED' ? 'DERIVED' : c.provenance
  return { clA: { value: c.clA, unit: 'm²', provenance: prov, ...detail('ClA') }, cdA: { value: c.cdA, unit: 'm²', provenance: prov, ...detail('CdA') }, aeroBalance: { value: c.balance, unit: 'fraction', provenance: prov, ...detail('Balance') } }
}
