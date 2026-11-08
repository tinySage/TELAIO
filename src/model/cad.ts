/**
 * CAD interaction maths, independent of rendering. All coordinates are in the vehicle study frame:
 * x forward, y up, z to the left. Scene coordinates are dimensionless study units, not millimetres,
 * so every measured value is reported as study units.
 */
import type { Vec3 } from './components'

export type Axis = 'x' | 'y' | 'z'
export const AXES: Axis[] = ['x', 'y', 'z']
export const STUDY_UNITS = 'study units'

/** The scene presents the vehicle with this fixed rotation; measurements and sections are in the vehicle frame. */
export const VEHICLE_FRAME_ROTATION: Vec3 = [0.12, -0.42, 0]

export type SectionSettings = { axis: Axis; offset: number; flip: boolean }

/** Bounds of the section offset per axis, in study units, covering the whole vehicle with margin. */
export const SECTION_RANGE: Record<Axis, [number, number]> = { x: [-2.4, 2.6], y: [-0.8, 1.0], z: [-1.3, 1.3] }

/**
 * Section plane as normal · p + constant = 0, in the vehicle frame. Geometry where
 * normal · p + constant < 0 is cut away; by default that keeps the side at or below the offset.
 */
export function sectionPlane({ axis, offset, flip }: SectionSettings): { normal: Vec3; constant: number } {
  const sign = flip ? 1 : -1
  const normal: Vec3 = [axis === 'x' ? sign : 0, axis === 'y' ? sign : 0, axis === 'z' ? sign : 0]
  return { normal, constant: -sign * offset }
}

/** True when the point survives the section (is on the kept side, or on the plane). */
export function keptBySection(point: Vec3, settings: SectionSettings): boolean {
  const { normal, constant } = sectionPlane(settings)
  return normal[0] * point[0] + normal[1] * point[1] + normal[2] * point[2] + constant >= 0
}

export function clampSectionOffset(axis: Axis, offset: number): number {
  const [min, max] = SECTION_RANGE[axis]
  return Math.min(max, Math.max(min, offset))
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const length = (a: Vec3) => Math.sqrt(dot(a, a))

export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b))
}

/** Angle at `vertex` between the rays to `a` and `b`, in degrees; null when either ray is degenerate. */
export function angleDegrees(a: Vec3, vertex: Vec3, b: Vec3): number | null {
  const u = sub(a, vertex), v = sub(b, vertex)
  const lu = length(u), lv = length(v)
  if (lu < 1e-9 || lv < 1e-9) return null
  const cosine = Math.min(1, Math.max(-1, dot(u, v) / (lu * lv)))
  return (Math.acos(cosine) * 180) / Math.PI
}

export type MeasureMode = 'off' | 'distance' | 'angle'
export const pointsRequired: Record<Exclude<MeasureMode, 'off'>, number> = { distance: 2, angle: 3 }

export type MeasurementResult = { complete: boolean; label: string; value: string; detail?: string }

const fixed = (value: number) => value.toFixed(3)
export const formatPoint = (p: Vec3) => '(' + p.map(fixed).join(', ') + ')'

/** Text for the measurement readout; values carry their unit and never imply physical dimensions. */
export function describeMeasurement(mode: MeasureMode, points: Vec3[]): MeasurementResult | null {
  if (mode === 'off') return null
  const needed = pointsRequired[mode]
  if (points.length < needed) {
    const prompt = mode === 'distance' ? ['Pick the first point', 'Pick the second point'] : ['Pick the first point', 'Pick the vertex', 'Pick the third point']
    return { complete: false, label: mode === 'distance' ? 'Distance' : 'Angle', value: prompt[points.length] }
  }
  if (mode === 'distance') {
    const [a, b] = points
    const delta = sub(b, a)
    return { complete: true, label: 'Distance', value: fixed(distance(a, b)) + ' ' + STUDY_UNITS, detail: 'Δx ' + fixed(delta[0]) + ' · Δy ' + fixed(delta[1]) + ' · Δz ' + fixed(delta[2]) }
  }
  const angle = angleDegrees(points[0], points[1], points[2])
  return { complete: true, label: 'Angle', value: angle === null ? 'Undefined (coincident points)' : angle.toFixed(2) + '°', detail: 'Vertex ' + formatPoint(points[1]) }
}

/** Adds a picked point, starting a new measurement once the previous one is complete. */
export function addMeasurePoint(mode: MeasureMode, points: Vec3[], point: Vec3): Vec3[] {
  if (mode === 'off') return []
  return points.length >= pointsRequired[mode] ? [point] : [...points, point]
}
