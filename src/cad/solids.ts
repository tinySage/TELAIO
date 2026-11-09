/**
 * Sketch-to-solid modelling. A feature is a closed 2D profile on a sketch plane, turned into a solid by
 * extrusion or revolution. Every dimension is a parameter expression, so features regenerate when a
 * parameter changes. Area, centroid and volume are computed exactly from the profile (shoelace formula,
 * Pappus's theorem); the triangle mesh is only for display and drafting.
 *
 * Sketch planes are right-handed, with the normal along the third axis of the name:
 *   XY: u = x, v = y, normal z.   YZ: u = y, v = z, normal x.   ZX: u = z, v = x, normal y.
 * All lengths are study units, like the rest of the study frame.
 */
import * as THREE from 'three'
import { evaluate, resolveParameters, type Parameter } from './expr'
import type { Vec3 } from '../model/components'

export type P2 = [number, number]
export type Num = string
export type SketchPlane = 'XY' | 'YZ' | 'ZX'
export const SKETCH_PLANES: SketchPlane[] = ['XY', 'YZ', 'ZX']

export type Profile =
  | { kind: 'rect'; cu: Num; cv: Num; width: Num; height: Num }
  | { kind: 'circle'; cu: Num; cv: Num; radius: Num }
  | { kind: 'polygon'; points: [Num, Num][] }

export type Operation =
  | { kind: 'extrude'; depth: Num; symmetric: boolean }
  | { kind: 'revolve'; axis: 'u' | 'v'; angle: Num }

export type Feature = { id: string; name: string; plane: SketchPlane; offset: Num; profile: Profile; op: Operation; visible: boolean }

export type ResolvedOperation = { kind: 'extrude'; depth: number; symmetric: boolean } | { kind: 'revolve'; axis: 'u' | 'v'; angle: number }
export type ResolvedFeature = {
  id: string; name: string; plane: SketchPlane; offset: number; polygon: P2[]; op: ResolvedOperation | null; visible: boolean
  /** Profile area, centroid in plane coordinates, solid volume (su², su, su³); null when the feature has issues. */
  area: number | null; centroid: P2 | null; volume: number | null
  issues: string[]
}

export const CIRCLE_SEGMENTS = 64

// ---------- 2D geometry ----------

export function signedArea(poly: P2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; a += x1 * y2 - x2 * y1 }
  return a / 2
}

export function centroid(poly: P2[]): P2 {
  const a = signedArea(poly)
  let cx = 0, cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], k = x1 * y2 - x2 * y1
    cx += (x1 + x2) * k; cy += (y1 + y2) * k
  }
  return [cx / (6 * a), cy / (6 * a)]
}

const cross2 = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
function segmentsCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const d1 = cross2(c, d, a), d2 = cross2(c, d, b), d3 = cross2(a, b, c), d4 = cross2(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** True when two non-adjacent edges of the closed polygon cross. */
export function selfIntersects(poly: P2[]): boolean {
  const n = poly.length
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue
    if (segmentsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true
  }
  return false
}

// ---------- Resolution ----------

/** Turns a feature's expressions into numbers and checks the profile and operation. */
export function resolveFeature(f: Feature, lookup: (name: string) => number): ResolvedFeature {
  const issues: string[] = []
  const num = (label: string, text: Num): number => { try { return evaluate(text, lookup) } catch (e) { issues.push(`${label}: ${(e as Error).message}`); return NaN } }
  const offset = num('Plane offset', f.offset)
  let polygon: P2[] = []
  const p = f.profile
  if (p.kind === 'rect') {
    const cu = num('Centre u', p.cu), cv = num('Centre v', p.cv), w = num('Width', p.width), h = num('Height', p.height)
    if (w <= 0 || h <= 0) issues.push('Width and height must be positive')
    polygon = [[cu - w / 2, cv - h / 2], [cu + w / 2, cv - h / 2], [cu + w / 2, cv + h / 2], [cu - w / 2, cv + h / 2]]
  } else if (p.kind === 'circle') {
    const cu = num('Centre u', p.cu), cv = num('Centre v', p.cv), r = num('Radius', p.radius)
    if (r <= 0) issues.push('Radius must be positive')
    polygon = Array.from({ length: CIRCLE_SEGMENTS }, (_, i) => { const t = 2 * Math.PI * i / CIRCLE_SEGMENTS; return [cu + r * Math.cos(t), cv + r * Math.sin(t)] as P2 })
  } else {
    polygon = p.points.map(([u, v], i) => [num(`Point ${i + 1} u`, u), num(`Point ${i + 1} v`, v)] as P2)
    if (polygon.length < 3) issues.push('A profile needs at least 3 points')
  }
  let op: ResolvedOperation | null = null
  if (f.op.kind === 'extrude') {
    const depth = num('Depth', f.op.depth)
    if (depth <= 0) issues.push('Depth must be positive')
    op = { kind: 'extrude', depth, symmetric: f.op.symmetric }
  } else {
    const angle = num('Angle', f.op.angle)
    if (angle <= 0 || angle > 360) issues.push('Angle must be in (0°, 360°]')
    op = { kind: 'revolve', axis: f.op.axis, angle }
  }
  const finite = issues.length === 0
  if (finite && polygon.length >= 3) {
    if (selfIntersects(polygon)) issues.push('Profile edges cross each other')
    else if (Math.abs(signedArea(polygon)) < 1e-12) issues.push('Profile has zero area')
  }
  if (issues.length === 0 && op.kind === 'revolve') {
    // Radius is the distance from the axis: |v| for the u axis, |u| for the v axis. The profile must not straddle it.
    const r = polygon.map(([u, v]) => op!.kind === 'revolve' && op!.axis === 'u' ? v : u)
    if (r.some((x) => x < -1e-12) && r.some((x) => x > 1e-12)) issues.push('Profile crosses the revolve axis')
  }
  if (issues.length) return { id: f.id, name: f.name, plane: f.plane, offset, polygon, op, visible: f.visible, area: null, centroid: null, volume: null, issues }
  const area = Math.abs(signedArea(polygon)), c = centroid(polygon)
  let volume: number
  if (op.kind === 'extrude') volume = area * op.depth
  else volume = rad(op.angle) * area * Math.abs(op.axis === 'u' ? c[1] : c[0]) // Pappus: swept angle × area × centroid radius
  return { id: f.id, name: f.name, plane: f.plane, offset, polygon, op, visible: f.visible, area, centroid: c, volume, issues }
}
const rad = (d: number) => d * Math.PI / 180

export type DesignModel = { params: Parameter[]; features: Feature[] }

export function resolveDesign(design: DesignModel) {
  const params = resolveParameters(design.params)
  const lookup = (name: string) => {
    if (name in params.values) return params.values[name]
    throw new Error(name in params.errors ? `Parameter "${name}" has an error` : `Unknown parameter "${name}"`)
  }
  return { params, features: design.features.map((f) => resolveFeature(f, lookup)) }
}

// ---------- Plane frames and meshes ----------

/** Unit vectors (u, v, normal) of a sketch plane in the study frame. */
export const PLANE_BASIS: Record<SketchPlane, [Vec3, Vec3, Vec3]> = {
  XY: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  YZ: [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  ZX: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
}

/** Study-frame point of plane coordinates (u, v) at distance w along the plane normal. */
export function planePoint(plane: SketchPlane, u: number, v: number, w: number): Vec3 {
  const [a, b, n] = PLANE_BASIS[plane]
  return [0, 1, 2].map((k) => a[k] * u + b[k] * v + n[k] * w) as Vec3
}

const basisMatrix = (plane: SketchPlane) => { const [a, b, n] = PLANE_BASIS[plane]; return new THREE.Matrix4().makeBasis(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...n)) }

/** Display mesh of a resolved feature, in the study frame. Null when the feature has issues. */
export function featureGeometry(f: ResolvedFeature): THREE.BufferGeometry | null {
  if (f.issues.length || !f.op) return null
  let geometry: THREE.BufferGeometry
  if (f.op.kind === 'extrude') {
    const ccw = signedArea(f.polygon) > 0 ? f.polygon : [...f.polygon].reverse()
    const shape = new THREE.Shape(ccw.map(([u, v]) => new THREE.Vector2(u, v)))
    geometry = new THREE.ExtrudeGeometry(shape, { depth: f.op.depth, bevelEnabled: false, curveSegments: 1 })
    geometry.translate(0, 0, f.op.symmetric ? -f.op.depth / 2 : 0)
  } else {
    const axisU = f.op.axis === 'u'
    // Lathe revolves (radius, height) about local Y; local Z holds the radius at zero sweep.
    const sign = f.polygon.some(([u, v]) => (axisU ? v : u) < -1e-12) ? -1 : 1
    const loop = [...f.polygon, f.polygon[0]].map(([u, v]) => new THREE.Vector2(sign * (axisU ? v : u), axisU ? u : v))
    const full = f.op.angle >= 360
    geometry = new THREE.LatheGeometry(loop, 96, 0, full ? Math.PI * 2 : rad(f.op.angle))
    // Local (X, Y, Z) → plane (w, height, radius·sign): Y is the axis, Z the in-plane radial direction.
    const m = axisU
      ? new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, sign, 0, 1, 0, 0, 0, 0, 0, 0, 1)
      : new THREE.Matrix4().set(0, 0, sign, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)
    geometry.applyMatrix4(m)
  }
  geometry.translate(0, 0, f.offset)
  geometry.applyMatrix4(basisMatrix(f.plane))
  geometry.computeVertexNormals()
  return geometry
}

/** Enclosed volume of a closed triangle mesh by the divergence theorem (independent check of the closed form). */
export function meshVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.getAttribute('position'), index = geometry.getIndex()
  const count = index ? index.count : pos.count
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i)
  let v = 0
  for (let i = 0; i < count; i += 3) v += at(i).dot(at(i + 1).cross(at(i + 2))) / 6
  return Math.abs(v)
}
