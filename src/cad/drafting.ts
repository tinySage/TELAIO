/**
 * 2D drafting: orthographic projections of the study model with snapping, dimensions and a command line.
 *
 * Views (third-angle style, study frame x fwd, y up, z left):
 *   side  — seen from the car's left:  u = x,  v = y  (nose to the right)
 *   top   — seen from above:           u = −z, v = x  (nose up, car-left on the left)
 *   front — seen from ahead:           u = z,  v = y  (car-left on the right)
 * Model edges are crease, boundary and silhouette edges of the display meshes. Hidden lines are not
 * removed, so a drawing shows every edge through the model, like a wireframe.
 */
import * as THREE from 'three'
import type { Vec3 } from '../model/components'
import type { P2 } from './solids'

export type DraftView = 'side' | 'top' | 'front'
export const DRAFT_VIEWS: DraftView[] = ['side', 'top', 'front']

export function project(view: DraftView, p: Vec3): P2 {
  if (view === 'side') return [p[0], p[1]]
  if (view === 'top') return [-p[2], p[0]]
  return [p[2], p[1]]
}
/** Direction the view looks along (only its line matters for silhouettes). */
const VIEW_AXIS: Record<DraftView, Vec3> = { side: [0, 0, 1], top: [0, 1, 0], front: [1, 0, 0] }

export type Segment = [P2, P2]

/**
 * Drawing edges of a mesh in a view: boundary edges, creases sharper than `creaseDeg`, and silhouette
 * edges where the surface turns from facing the viewer to facing away.
 */
export function meshEdges(geometry: THREE.BufferGeometry, view: DraftView, creaseDeg = 30): Segment[] {
  const pos = geometry.getAttribute('position'), index = geometry.getIndex()
  const count = index ? index.count : pos.count
  // Weld coincident vertices so edges shared by separately indexed faces are recognised.
  const keyOf = new Map<string, number>(), points: THREE.Vector3[] = []
  const weld = (i: number) => {
    const v = new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i)
    const key = v.toArray().map((x) => Math.round(x * 1e6)).join(',')
    let id = keyOf.get(key)
    if (id === undefined) { id = points.length; keyOf.set(key, id); points.push(v) }
    return id
  }
  const edges = new Map<string, { a: number; b: number; normals: THREE.Vector3[] }>()
  for (let i = 0; i < count; i += 3) {
    const tri = [weld(i), weld(i + 1), weld(i + 2)]
    if (tri[0] === tri[1] || tri[1] === tri[2] || tri[0] === tri[2]) continue
    const n = new THREE.Vector3().subVectors(points[tri[1]], points[tri[0]]).cross(new THREE.Vector3().subVectors(points[tri[2]], points[tri[0]]))
    if (n.lengthSq() < 1e-24) continue
    n.normalize()
    for (let k = 0; k < 3; k++) {
      const a = Math.min(tri[k], tri[(k + 1) % 3]), b = Math.max(tri[k], tri[(k + 1) % 3]), key = a + '_' + b
      const e = edges.get(key) ?? { a, b, normals: [] }
      e.normals.push(n); edges.set(key, e)
    }
  }
  const axis = new THREE.Vector3(...VIEW_AXIS[view]), cosCrease = Math.cos(creaseDeg * Math.PI / 180)
  const out: Segment[] = []
  for (const { a, b, normals } of edges.values()) {
    let keep = normals.length !== 2
    if (!keep) {
      const [n1, n2] = normals
      const d1 = n1.dot(axis), d2 = n2.dot(axis)
      keep = n1.dot(n2) < cosCrease || (d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)
    }
    if (!keep) continue
    const pa = project(view, points[a].toArray() as Vec3), pb = project(view, points[b].toArray() as Vec3)
    if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > 1e-9) out.push([pa, pb])
  }
  return out
}

// ---------- Annotations ----------

export type DimensionKind = 'aligned' | 'horizontal' | 'vertical'
export type Annotation =
  | { id: string; kind: 'line'; a: P2; b: P2 }
  | { id: string; kind: 'dimension'; dim: DimensionKind; a: P2; b: P2; offset: number }
  | { id: string; kind: 'note'; at: P2; text: string }

export function dimensionValue(dim: DimensionKind, a: P2, b: P2): number {
  if (dim === 'horizontal') return Math.abs(b[0] - a[0])
  if (dim === 'vertical') return Math.abs(b[1] - a[1])
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/** Geometry for drawing a dimension: the two extension lines, the dimension line, and the text anchor. */
export function dimensionLayout(dim: DimensionKind, a: P2, b: P2, offset: number) {
  let p1: P2, p2: P2
  if (dim === 'horizontal') { const y = Math.max(a[1], b[1]) + offset; p1 = [a[0], y]; p2 = [b[0], y] }
  else if (dim === 'vertical') { const x = Math.max(a[0], b[0]) + offset; p1 = [x, a[1]]; p2 = [x, b[1]] }
  else {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n: P2 = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
    p1 = [a[0] + n[0] * offset, a[1] + n[1] * offset]; p2 = [b[0] + n[0] * offset, b[1] + n[1] * offset]
  }
  return { extension: [[a, p1], [b, p2]] as Segment[], line: [p1, p2] as Segment, text: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2] as P2, angle: Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) }
}

// ---------- Snapping ----------

export type SnapKind = 'endpoint' | 'midpoint' | 'grid' | 'free'
export type Snap = { point: P2; kind: SnapKind }

/** Unique snap targets: endpoints and midpoints of segments. */
export function snapTargets(segments: Segment[]): { endpoints: P2[]; midpoints: P2[] } {
  const seen = new Set<string>(), endpoints: P2[] = [], midpoints: P2[] = []
  const add = (list: P2[], p: P2) => { const k = Math.round(p[0] * 1e5) + ',' + Math.round(p[1] * 1e5); if (!seen.has(k)) { seen.add(k); list.push(p) } }
  for (const [a, b] of segments) { add(endpoints, a); add(endpoints, b) }
  for (const [a, b] of segments) add(midpoints, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  return { endpoints, midpoints }
}

/** Nearest endpoint, then midpoint, within `tolerance`; else the grid (if on); else the cursor itself. */
export function snap(cursor: P2, targets: { endpoints: P2[]; midpoints: P2[] }, tolerance: number, grid: number | null): Snap {
  for (const [kind, list] of [['endpoint', targets.endpoints], ['midpoint', targets.midpoints]] as const) {
    let best: P2 | null = null, bestD = tolerance
    for (const p of list) { const d = Math.hypot(p[0] - cursor[0], p[1] - cursor[1]); if (d <= bestD) { best = p; bestD = d } }
    if (best) return { point: best, kind }
  }
  if (grid && grid > 0) return { point: [Math.round(cursor[0] / grid) * grid, Math.round(cursor[1] / grid) * grid], kind: 'grid' }
  return { point: cursor, kind: 'free' }
}

// ---------- Command line ----------

export type Command =
  | { action: 'line'; points: P2[] }
  | { action: 'dimension'; dim: DimensionKind; a: P2; b: P2; offset: number }
  | { action: 'note'; at: P2; text: string }
  | { action: 'undo' } | { action: 'erase-all' } | { action: 'fit' }
  | { action: 'grid'; size: number | null }
  | { action: 'tool'; tool: 'select' | 'line' | 'dimension' }
  | { action: 'view'; view: DraftView }

/**
 * Parses an AutoCAD-style command. Points are "u,v" absolute or "@du,dv" relative to the previous point
 * (or to `last` for the first point). Examples: "LINE 0,0 1,0 @0,0.5", "DIM 0,0 1,0 H 0.1",
 * "NOTE 0.2,0.4 Lower wishbone", "GRID 0.05", "GRID OFF", "UNDO", "ERASE ALL", "FIT", "VIEW TOP".
 */
export function parseCommand(input: string, last: P2 | null = null): { command: Command | null; error: string | null } {
  const words = input.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { command: null, error: null }
  const name = words[0].toUpperCase(), args = words.slice(1)
  const fail = (error: string) => ({ command: null, error })
  const points = (tokens: string[]): P2[] | string => {
    const out: P2[] = []
    let prev = last
    for (const t of tokens) {
      const m = /^(@)?(-?\d*\.?\d+(?:e-?\d+)?),(-?\d*\.?\d+(?:e-?\d+)?)$/i.exec(t)
      if (!m) return `"${t}" is not a point (use u,v or @du,dv)`
      if (m[1] && !prev) return `"${t}" is relative but there is no previous point`
      const p: P2 = m[1] ? [prev![0] + Number(m[2]), prev![1] + Number(m[3])] : [Number(m[2]), Number(m[3])]
      out.push(p); prev = p
    }
    return out
  }
  switch (name) {
    case 'L': case 'LINE': {
      if (args.length === 0) return { command: { action: 'tool', tool: 'line' }, error: null }
      const p = points(args)
      if (typeof p === 'string') return fail(p)
      if (p.length < 2) return fail('LINE needs at least two points')
      return { command: { action: 'line', points: p }, error: null }
    }
    case 'DIM': case 'D': {
      if (args.length === 0) return { command: { action: 'tool', tool: 'dimension' }, error: null }
      const p = points(args.slice(0, 2))
      if (typeof p === 'string') return fail(p)
      if (p.length < 2) return fail('DIM needs two points')
      const mode = (args[2] ?? 'A').toUpperCase()
      const dim: DimensionKind | undefined = ({ A: 'aligned', H: 'horizontal', V: 'vertical' } as const)[mode as 'A' | 'H' | 'V']
      if (!dim) return fail('Dimension type must be A, H or V')
      const offset = args[3] === undefined ? 0.1 : Number(args[3])
      if (!Number.isFinite(offset)) return fail('Offset must be a number')
      return { command: { action: 'dimension', dim, a: p[0], b: p[1], offset }, error: null }
    }
    case 'NOTE': case 'TEXT': {
      const p = points(args.slice(0, 1))
      if (typeof p === 'string') return fail(p)
      const text = args.slice(1).join(' ')
      if (!p.length || !text) return fail('NOTE needs a point and text')
      return { command: { action: 'note', at: p[0], text }, error: null }
    }
    case 'U': case 'UNDO': return { command: { action: 'undo' }, error: null }
    case 'ERASE': return args[0]?.toUpperCase() === 'ALL' ? { command: { action: 'erase-all' }, error: null } : fail('Use ERASE ALL, or UNDO for the last item')
    case 'FIT': case 'ZOOM': return { command: { action: 'fit' }, error: null }
    case 'SELECT': case 'ESC': return { command: { action: 'tool', tool: 'select' }, error: null }
    case 'GRID': {
      if (args[0]?.toUpperCase() === 'OFF') return { command: { action: 'grid', size: null }, error: null }
      const size = Number(args[0])
      return size > 0 ? { command: { action: 'grid', size }, error: null } : fail('GRID needs a positive spacing or OFF')
    }
    case 'VIEW': {
      const view = args[0]?.toLowerCase() as DraftView
      return DRAFT_VIEWS.includes(view) ? { command: { action: 'view', view }, error: null } : fail('VIEW must be SIDE, TOP or FRONT')
    }
    default: return fail(`Unknown command "${words[0]}". Try LINE, DIM, NOTE, UNDO, ERASE ALL, GRID, VIEW, FIT`)
  }
}

export function bounds(segments: Segment[]): { min: P2; max: P2 } | null {
  if (!segments.length) return null
  const min: P2 = [Infinity, Infinity], max: P2 = [-Infinity, -Infinity]
  for (const s of segments) for (const p of s) { min[0] = Math.min(min[0], p[0]); min[1] = Math.min(min[1], p[1]); max[0] = Math.max(max[0], p[0]); max[1] = Math.max(max[1], p[1]) }
  return { min, max }
}
