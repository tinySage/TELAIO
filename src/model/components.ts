export type Provenance = 'ILLUSTRATIVE' | 'UNKNOWN'
export type Vec3 = [number, number, number]
export type Part = {
  id: string
  name: string
  system: string
  role: string
  parent: string
  material: string
  provenance: Provenance
  position: Vec3
  explode: Vec3
  shape: 'box' | 'rod' | 'wheel' | 'disc' | 'hub'
  size?: Vec3
  dimensions: string
  notes: string
  segments?: [Vec3, Vec3][]
}

const unknown = 'Unspecified'
const notEstablished = 'Not established'
const part = (id: string, name: string, system: string, role: string, parent: string, position: Vec3, explode: Vec3, shape: Part['shape'], size: Vec3, notes: string): Part =>
  ({ id, name, system, role, parent, position, explode, shape, size, material: unknown, provenance: 'ILLUSTRATIVE', dimensions: notEstablished, notes })

export const parts: Part[] = [
  part('chassis-node','Central monocoque study body','Chassis & structure','Primary central structural volume in the conceptual vehicle layout.','Vehicle structure',[-0.05,0.02,0],[0,0.28,0],'box',[2.65,0.38,0.56],'Simplified original block geometry. Not a dimensionally accurate survival cell or certified monocoque.'),
  part('floor-reference','Underfloor reference','Aerodynamics','Central floor reference volume beneath the body.','Aerodynamic package',[-0.1,-0.27,0],[0,-0.5,0],'box',[2.9,0.08,1.12],'Simplified study volume only; no floor edge, tunnel or aerodynamic surface is represented as validated.'),
  part('nose-reference','Nose structure reference','Chassis & structure','Forward body volume connecting the central body region to the front wing reference.','Vehicle structure',[1.68,0.02,0],[0.38,0.15,0],'box',[1.15,0.2,0.3],'Conceptual nose block, not an F1 homologation or crash structure model.'),
  part('front-wing-reference','Front wing reference','Aerodynamics','Transverse front aerodynamic reference element.','Aerodynamic package',[2.12,-0.34,0],[0.35,-0.2,0],'box',[0.5,0.09,1.65],'Single simplified volume; no flap slots, endplates or aerodynamic performance are implied.'),
  part('sidepod-left','Left sidepod reference','Aerodynamics','Left-side body volume adjacent to the central body.','Aerodynamic package',[-0.25,-0.03,0.47],[-0.1,0.12,0.55],'box',[0.92,0.3,0.42],'Generic study volume; cooling inlets and internal ducting are not modelled.'),
  part('sidepod-right','Right sidepod reference','Aerodynamics','Right-side body volume adjacent to the central body.','Aerodynamic package',[-0.25,-0.03,-0.47],[-0.1,0.12,-0.55],'box',[0.92,0.3,0.42],'Generic study volume; cooling inlets and internal ducting are not modelled.'),
  part('engine-cover-reference','Power-unit cover reference','Powertrain', 'Upper rear body volume representing a power-unit cover envelope.','Powertrain package',[-0.92,0.28,0],[0,-0.18,0],'box',[0.95,0.42,0.42],'Envelope only. No engine, hybrid system, gearbox or cooling specification is represented.'),
  part('rear-wing-reference','Rear wing reference','Aerodynamics','Transverse rear aerodynamic reference element.','Aerodynamic package',[-1.72,0.62,0],[0,-0.25,0],'box',[0.32,0.08,1.18],'Single simplified volume; no DRS mechanism or aerodynamic performance is implied.'),
  part('front-upright','Front upright','Front suspension','Locates the wheel assembly and provides suspension and steering attachment interfaces.','Front corner assembly',[0.9,0,0.72],[1.25,0,0],'hub',[0.2,0.32,0.2],'Reference geometry only. No manufacturing dimensions are asserted.'),
  { ...part('upper-wishbone','Upper wishbone','Front suspension','Upper suspension link between chassis-side pivots and upright.','Front suspension',[0.12,0.42,0.36],[0,0.75,0],'rod',[0.05,0.05,0.05],'Conceptual A-arm representation; pivot coordinates are illustrative.'), segments:[[[-0.48,0.48,0.16],[0.9,0.34,0.64]],[[-0.48,0.48,0.56],[0.9,0.34,0.8]]] },
  { ...part('lower-wishbone','Lower wishbone','Front suspension','Lower suspension link controlling upright motion with the upper link.','Front suspension',[0.12,-0.42,0.36],[0,-0.75,0],'rod',[0.05,0.05,0.05],'Conceptual A-arm representation; pivot coordinates are illustrative.'), segments:[[[-0.48,-0.43,0.12],[0.9,-0.32,0.64]],[[-0.48,-0.43,0.6],[0.9,-0.32,0.8]]] },
  { ...part('push-rod','Push-rod','Front suspension','Transfers wheel/upright motion to an inboard spring-damper mechanism.','Front suspension',[0.48,0.03,0.5],[0.25,0.2,0.7],'rod',[0.04,0.04,0.04],'Simplified link; rocker and damper internals are not represented.'), segments:[[[0.58,-0.28,0.7],[0.02,0.82,0.18]]] },
  part('brake-disc','Front brake disc reference','Braking system','Rotating friction-surface reference at the front corner.','Front corner assembly',[1.02,0,0.78],[0.65,0,0.65],'disc',[0.3,0.07,0.3],'Generic disc envelope. Material, ventilation and dimensions are unknown.'),
  part('wheel-tyre','Front-left wheel & tyre','Wheels & tyres','Front-left tyre and wheel reference volume.','Front corner assembly',[1.2,0,0.96],[1.6,0,0.2],'wheel',[0.48,0.16,0.48],'Generic study geometry. No tyre compound, rim specification or dimensional claim.'),
  part('front-right-wheel','Front-right wheel & tyre','Wheels & tyres','Opposite front tyre and wheel reference volume.','Front corner assembly',[1.2,0,-0.96],[1.6,0,-0.2],'wheel',[0.48,0.16,0.48],'Generic study geometry; no detailed opposite-side suspension is included yet.'),
  part('rear-left-wheel','Rear-left wheel & tyre','Wheels & tyres','Rear-left tyre and wheel reference volume.','Rear corner assembly',[-1.28,0,0.94],[-1.2,0,0.35],'wheel',[0.53,0.18,0.53],'Generic study geometry; rear suspension and brake internals are not modelled.'),
  part('rear-right-wheel','Rear-right wheel & tyre','Wheels & tyres','Rear-right tyre and wheel reference volume.','Rear corner assembly',[-1.28,0,-0.94],[-1.2,0,-0.35],'wheel',[0.53,0.18,0.53],'Generic study geometry; rear suspension and brake internals are not modelled.'),
]

export const provenanceLabel = (value: Provenance) => value === 'ILLUSTRATIVE' ? 'Illustrative' : 'Unknown'
