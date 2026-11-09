/**
 * Engineering quantities with provenance. Every value TELAIO calculates with carries one of five labels,
 * and every result inherits the weakest label among its inputs:
 *
 *   UNKNOWN > ILLUSTRATIVE > ESTIMATED > DERIVED/SOURCED
 *
 * A result computed only from SOURCED or DERIVED inputs is DERIVED. Any UNKNOWN input makes the result
 * UNKNOWN (no value). This module has no rendering dependencies.
 */

export type Provenance = 'SOURCED' | 'DERIVED' | 'ESTIMATED' | 'ILLUSTRATIVE' | 'UNKNOWN'
export const PROVENANCES: Provenance[] = ['SOURCED', 'DERIVED', 'ESTIMATED', 'ILLUSTRATIVE', 'UNKNOWN']
export const PROVENANCE_MEANING: Record<Provenance, string> = {
  SOURCED: 'Supported by a documented source',
  DERIVED: 'Calculated from known inputs',
  ESTIMATED: 'Engineering estimate with stated assumptions',
  ILLUSTRATIVE: 'Visual or demonstration value',
  UNKNOWN: 'Not currently established',
}

export type Quantity = {
  value: number | null
  unit: string
  provenance: Provenance
  /** Required for SOURCED: citation, document or measurement record. */
  source?: string
  /** Required for ESTIMATED: the assumptions behind the estimate. */
  note?: string
}

export const unknown = (unit: string): Quantity => ({ value: null, unit, provenance: 'UNKNOWN' })
export const quantity = (value: number, unit: string, provenance: Provenance, detail: { source?: string; note?: string } = {}): Quantity => ({ value, unit, provenance, ...detail })

export function isKnown(q: Quantity | undefined): q is Quantity & { value: number } {
  return !!q && q.provenance !== 'UNKNOWN' && typeof q.value === 'number' && Number.isFinite(q.value)
}

/** Problems that make a quantity unusable or under-documented. */
export function quantityIssues(q: Quantity, label: string): string[] {
  const issues: string[] = []
  if (q.provenance === 'UNKNOWN') return issues
  if (typeof q.value !== 'number' || !Number.isFinite(q.value)) issues.push(label + ': value missing for ' + q.provenance + ' quantity')
  if (q.provenance === 'SOURCED' && !q.source?.trim()) issues.push(label + ': SOURCED values need a source record')
  if (q.provenance === 'ESTIMATED' && !q.note?.trim()) issues.push(label + ': ESTIMATED values need stated assumptions')
  return issues
}

const RANK: Record<Provenance, number> = { SOURCED: 0, DERIVED: 0, ESTIMATED: 1, ILLUSTRATIVE: 2, UNKNOWN: 3 }

/** Provenance of a value calculated from the given inputs. */
export function derivedProvenance(inputs: Provenance[]): Provenance {
  const worst = Math.max(0, ...inputs.map((p) => RANK[p]))
  return worst === 0 ? 'DERIVED' : worst === 1 ? 'ESTIMATED' : worst === 2 ? 'ILLUSTRATIVE' : 'UNKNOWN'
}

/**
 * A calculated result: a value (null when not computable), its provenance, the inputs that were
 * missing, and the modelling assumptions that apply.
 */
export type Result<T> = { value: T | null; unit: string; provenance: Provenance; missing: string[]; assumptions: string[] }

export function result<T>(value: T | null, unit: string, inputs: Provenance[], missing: string[] = [], assumptions: string[] = []): Result<T> {
  if (missing.length || value === null) return { value: null, unit, provenance: 'UNKNOWN', missing, assumptions }
  return { value, unit, provenance: derivedProvenance(inputs), missing, assumptions }
}

/** Collects known values from named quantities; names of unknown ones go to `missing`. */
export function gather<K extends string>(inputs: Record<K, Quantity>): { values: Record<K, number>; provenances: Provenance[]; missing: string[] } {
  const values = {} as Record<K, number>
  const provenances: Provenance[] = []
  const missing: string[] = []
  for (const key of Object.keys(inputs) as K[]) {
    const q = inputs[key]
    if (isKnown(q)) { values[key] = q.value; provenances.push(q.provenance) } else missing.push(key)
  }
  return { values, provenances, missing }
}

export function formatValue(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const magnitude = Math.abs(value)
  if (magnitude !== 0 && (magnitude >= 1e6 || magnitude < 1e-3)) return value.toExponential(digits - 1)
  return value.toFixed(digits)
}

/** Parses stored quantities defensively, falling back to UNKNOWN in the expected unit. */
export function parseQuantity(raw: unknown, unit: string): Quantity {
  if (!raw || typeof raw !== 'object') return unknown(unit)
  const q = raw as Partial<Quantity>
  const provenance = PROVENANCES.includes(q.provenance as Provenance) ? q.provenance as Provenance : 'UNKNOWN'
  const value = typeof q.value === 'number' && Number.isFinite(q.value) ? q.value : null
  return { value: provenance === 'UNKNOWN' ? null : value, unit, provenance: value === null ? 'UNKNOWN' : provenance, ...(typeof q.source === 'string' ? { source: q.source } : {}), ...(typeof q.note === 'string' ? { note: q.note } : {}) }
}
