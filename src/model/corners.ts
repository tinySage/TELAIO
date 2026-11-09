/**
 * Corner generation: the front-left corner is the authored reference; the other three corners are
 * derived from it by explicit ID maps plus a mirror (z → −z) or translation (front axle → rear axle).
 * Each map lists every source component, its derived ID and display name, and whether the derived
 * component already exists in the authored part list (in which case only its relations are merged).
 */
import type { Vec3 } from './components'

export type CornerEntry = { source: string; id: string; name: string; existing?: boolean }
export type CornerSpec = {
  code: string
  corner: string
  entries: CornerEntry[]
  transform: (point: Vec3) => Vec3
  transformExplode: (offset: Vec3) => Vec3
  transformRotation: (rotation: Vec3) => Vec3
}

const mirrorZ = (v: Vec3): Vec3 => [v[0], v[1], -v[2]]
// Reflecting through the z = 0 plane negates rotations about x and y.
const mirrorRotation = (r: Vec3): Vec3 => [-r[0], -r[1], r[2]]

// Front axle x = 0.9, rear axle x = −1.22; rear wheel centre sits 0.02 further inboard.
const REAR_SHIFT: Vec3 = [-2.12, 0, -0.02]
const toRear = (v: Vec3): Vec3 => [v[0] + REAR_SHIFT[0], v[1] + REAR_SHIFT[1], v[2] + REAR_SHIFT[2]]

const brakeSet = (prefix: string, corner: string): CornerEntry[] => [
  { source: 'front-hub', id: prefix + '-hub', name: corner + ' hub & wheel interface' },
  { source: 'brake-disc', id: prefix + '-brake-disc', name: corner + ' brake disc' },
  { source: 'caliper-mount', id: prefix + '-caliper-mount', name: corner + ' caliper mounting bracket' },
  { source: 'brake-caliper', id: prefix + '-brake-caliper', name: corner + ' brake caliper body' },
  { source: 'pad-inner-backing', id: prefix + '-pad-inner-backing', name: corner + ' inner pad backing plate' },
  { source: 'pad-inner', id: prefix + '-pad-inner', name: corner + ' inner brake pad lining' },
  { source: 'pad-outer', id: prefix + '-pad-outer', name: corner + ' outer brake pad lining' },
  { source: 'pad-outer-backing', id: prefix + '-pad-outer-backing', name: corner + ' outer pad backing plate' },
]

export const frontRight: CornerSpec = {
  code: 'fr', corner: 'Front-right',
  entries: [
    { source: 'front-upright', id: 'front-right-upright', name: 'Front-right upright' },
    { source: 'upper-wishbone', id: 'front-right-upper-wishbone', name: 'Front-right upper wishbone' },
    { source: 'lower-wishbone', id: 'front-right-lower-wishbone', name: 'Front-right lower wishbone' },
    { source: 'push-rod', id: 'front-right-push-rod', name: 'Front-right push-rod' },
    ...brakeSet('front-right', 'Front-right'),
    { source: 'wheel-tyre', id: 'front-right-wheel', name: 'Front-right wheel & tyre', existing: true },
  ],
  transform: mirrorZ, transformExplode: mirrorZ, transformRotation: mirrorRotation,
}

export const rearLeft: CornerSpec = {
  code: 'rl', corner: 'Rear-left',
  entries: [
    { source: 'front-upright', id: 'rear-upright', name: 'Rear upright reference', existing: true },
    ...brakeSet('rear-left', 'Rear-left'),
    { source: 'wheel-tyre', id: 'rear-left-wheel', name: 'Rear-left wheel & tyre', existing: true },
  ],
  transform: toRear,
  transformExplode: (v) => [-v[0], v[1], v[2]],
  transformRotation: (r) => r,
}

/** Applied after rear-left, so it mirrors the authored rear suspension and the generated rear-left brakes. */
export const rearRight: CornerSpec = {
  code: 'rr', corner: 'Rear-right',
  entries: [
    { source: 'rear-upright', id: 'rear-right-upright', name: 'Rear-right upright' },
    { source: 'rear-upper-link-front', id: 'rear-right-upper-link-front', name: 'Rear-right upper link — forward' },
    { source: 'rear-upper-link-rear', id: 'rear-right-upper-link-rear', name: 'Rear-right upper link — rearward' },
    { source: 'rear-pull-rod', id: 'rear-right-pull-rod', name: 'Rear-right pull-rod' },
    { source: 'rear-lower-link', id: 'rear-right-lower-link', name: 'Rear-right lower link' },
    { source: 'rear-toe-link', id: 'rear-right-toe-link', name: 'Rear-right toe link' },
    ...brakeSet('rear-left', 'Rear-left').map((entry) => ({
      source: entry.id, id: entry.id.replace('rear-left-', 'rear-right-'), name: entry.name.replace('Rear-left', 'Rear-right'),
    })),
    { source: 'rear-left-wheel', id: 'rear-right-wheel', name: 'Rear-right wheel & tyre', existing: true },
  ],
  transform: mirrorZ, transformExplode: mirrorZ, transformRotation: mirrorRotation,
}

/** Application order matters: rear-right derives from rear-left's generated parts. */
export const cornerSpecs: CornerSpec[] = [frontRight, rearLeft, rearRight]

/** Components shared by every corner; relations to them are kept rather than dropped. */
export const sharedComponents = new Set(['chassis-node'])

export function cornerIdMap(spec: CornerSpec): Map<string, string> {
  return new Map(spec.entries.map((entry) => [entry.source, entry.id]))
}

/** Maps an ID through a corner; returns null when the relation leaves the corner (and is not shared). */
export function mapCornerId(spec: CornerSpec, id: string): string | null {
  return cornerIdMap(spec).get(id) ?? (sharedComponents.has(id) ? id : null)
}
