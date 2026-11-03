export type Provenance = 'ILLUSTRATIVE' | 'UNKNOWN'
export type Part = {
  id: string
  name: string
  system: string
  role: string
  parent: string
  material: string
  provenance: Provenance
  position: [number, number, number]
  explode: [number, number, number]
  shape: 'box' | 'rod' | 'wheel' | 'disc' | 'hub'
  dimensions: string
  notes: string
  segments?: [[number, number, number], [number, number, number]][]
}

export const parts: Part[] = [
  { id: 'front-upright', name: 'Front upright', system: 'Front suspension', role: 'Locates the wheel assembly and provides suspension and steering attachment interfaces.', parent: 'Front corner assembly', material: 'Unspecified', provenance: 'UNKNOWN', position: [0.9, 0, 0], explode: [1.25, 0, 0], shape: 'hub', dimensions: 'Not established', notes: 'Reference geometry only. No manufacturing dimensions are asserted.' },
  { id: 'upper-wishbone', name: 'Upper wishbone', system: 'Front suspension', role: 'Upper suspension link between chassis-side pivots and upright.', parent: 'Front suspension', material: 'Unspecified', provenance: 'UNKNOWN', position: [0.12, 0.42, 0], explode: [0, 0.75, 0], shape: 'rod', dimensions: 'Not established', notes: 'Kinematic role is conceptual; pivot coordinates are illustrative.' },
  { id: 'lower-wishbone', name: 'Lower wishbone', system: 'Front suspension', role: 'Lower suspension link controlling upright motion with the upper link.', parent: 'Front suspension', material: 'Unspecified', provenance: 'UNKNOWN', position: [0.12, -0.42, 0], explode: [0, -0.75, 0], shape: 'rod', dimensions: 'Not established', notes: 'Kinematic role is conceptual; pivot coordinates are illustrative.' },
  { id: 'push-rod', name: 'Push-rod', system: 'Front suspension', role: 'Transfers wheel/upright motion to an inboard spring-damper mechanism.', parent: 'Front suspension', material: 'Unspecified', provenance: 'UNKNOWN', position: [0.48, 0.03, 0.16], explode: [0.25, 0.2, 0.7], shape: 'rod', dimensions: 'Not established', notes: 'A simplified link is shown to demonstrate component selection.' },
  { id: 'brake-disc', name: 'Brake disc', system: 'Braking system', role: 'Rotating friction surface for the brake assembly.', parent: 'Front corner assembly', material: 'Unspecified', provenance: 'UNKNOWN', position: [1.02, 0, 0.17], explode: [0.65, 0, 0.65], shape: 'disc', dimensions: 'Not established', notes: 'Disc geometry and ventilation are not representative of a specific race car.' },
  { id: 'wheel-tyre', name: 'Wheel & tyre', system: 'Wheels & tyres', role: 'Tyre contact interface and wheel structure.', parent: 'Front corner assembly', material: 'Unspecified', provenance: 'UNKNOWN', position: [1.2, 0, 0.42], explode: [1.6, 0, 0.2], shape: 'wheel', dimensions: 'Not established', notes: 'Generic study geometry. No tyre compound or dimensional claim.' },
  { id: 'chassis-node', name: 'Chassis interface', system: 'Chassis & structure', role: 'Conceptual mounting region for inboard suspension links.', parent: 'Chassis', material: 'Unspecified', provenance: 'UNKNOWN', position: [-0.48, 0, 0], explode: [-0.3, 0, 0], shape: 'box', dimensions: 'Not established', notes: 'A simplified structural reference block.' },
]

export const provenanceLabel = (value: Provenance) => value === 'ILLUSTRATIVE' ? 'Illustrative' : 'Unknown'
