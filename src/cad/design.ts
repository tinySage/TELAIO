/** Stored design document: parameters, sketch-based features and drafting annotations per view. */
import type { Parameter } from './expr'
import type { Feature } from './solids'
import { DRAFT_VIEWS, type Annotation, type DraftView } from './drafting'

export const DESIGN_STORAGE_KEY = 'telaio.design.v1'

export type Design = { params: Parameter[]; features: Feature[]; drawings: Record<DraftView, Annotation[]> }

export const emptyDesign = (): Design => ({ params: [], features: [], drawings: { side: [], top: [], front: [] } })

/** A small worked example: a rear-wing endplate and a wheel-nut, both driven by shared parameters. */
export const exampleDesign = (): Design => ({
  params: [
    { name: 'plate_t', expr: '0.02', note: 'Endplate thickness' },
    { name: 'plate_len', expr: '0.62', note: 'Endplate length' },
    { name: 'plate_h', expr: '0.5', note: 'Endplate height' },
    { name: 'wing_half_span', expr: '0.55', note: 'Endplate position from the centreline' },
    { name: 'nut_r', expr: '0.06' },
    { name: 'nut_len', expr: 'nut_r * 1.5', note: 'Nut length follows its radius' },
  ],
  features: [
    { id: 'f-endplate', name: 'Rear wing endplate (left)', plane: 'XY', offset: 'wing_half_span', visible: true,
      profile: { kind: 'polygon', points: [['-2.25', '0.55'], ['-2.25 + plate_len', '0.55'], ['-2.25 + plate_len', '0.55 + plate_h * 0.7'], ['-2.25 + plate_len * 0.6', '0.55 + plate_h'], ['-2.25', '0.55 + plate_h']] },
      op: { kind: 'extrude', depth: 'plate_t', symmetric: true } },
    { id: 'f-nut', name: 'Front wheel nut (left)', plane: 'YZ', offset: '0.9', visible: true,
      profile: { kind: 'rect', cu: '0', cv: '1.1 + nut_len / 2', width: 'nut_r * 2', height: 'nut_len' },
      op: { kind: 'extrude', depth: 'nut_r * 2', symmetric: true } },
    // YZ plane at x = 0.9: the v axis (y = 0) is the front wheel's spin axis, so revolving about it makes a ring.
    { id: 'f-spacer', name: 'Front hub spacer ring (left)', plane: 'YZ', offset: '0.9', visible: true,
      profile: { kind: 'polygon', points: [['nut_r * 0.8', '0.98'], ['nut_r * 1.5', '0.98'], ['nut_r * 1.5', '1.04'], ['nut_r * 0.8', '1.04']] },
      op: { kind: 'revolve', axis: 'v', angle: '360' } },
  ],
  drawings: { side: [], top: [], front: [] },
})

const isNumStr = (v: unknown) => typeof v === 'string'
const validFeature = (f: Feature) => !!f && typeof f.id === 'string' && typeof f.name === 'string' && ['XY', 'YZ', 'ZX'].includes(f.plane) && isNumStr(f.offset)
  && !!f.profile && ['rect', 'circle', 'polygon'].includes(f.profile.kind) && !!f.op && ['extrude', 'revolve'].includes(f.op.kind)

/** Parses stored JSON, dropping anything malformed rather than failing the whole document. */
export function parseDesign(raw: string | null): Design {
  const design = emptyDesign()
  if (!raw) return design
  try {
    const d = JSON.parse(raw)
    if (Array.isArray(d.params)) design.params = d.params.filter((p: Parameter) => typeof p?.name === 'string' && typeof p?.expr === 'string')
    if (Array.isArray(d.features)) design.features = d.features.filter(validFeature)
    for (const v of DRAFT_VIEWS) if (Array.isArray(d.drawings?.[v])) design.drawings[v] = d.drawings[v].filter((a: Annotation) => a && typeof a.id === 'string' && ['line', 'dimension', 'note'].includes(a.kind))
  } catch { /* unreadable: start empty */ }
  return design
}

let counter = 0
export const newId = (prefix: string) => prefix + '-' + Date.now().toString(36) + (counter++).toString(36)
