import { cornerSpecs, type CornerSpec } from './corners'

export type Provenance = 'ILLUSTRATIVE' | 'UNKNOWN'
export type Vec3 = [number, number, number]
export type LoftSection = { x: number; y: number; width: number; height: number }
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
  shape: 'box' | 'rod' | 'wheel' | 'disc' | 'hub' | 'loft'
  size?: Vec3
  dimensions: string
  notes: string
  segments?: [Vec3, Vec3][]
  sections?: LoftSection[]
  /** Optional Euler rotation (radians) applied to primitive shapes. */
  rotation?: Vec3
}

const unknown = 'Unspecified'
const notEstablished = 'Not established'
const part = (id: string, name: string, system: string, role: string, parent: string, position: Vec3, explode: Vec3, shape: Part['shape'], size: Vec3, notes: string): Part =>
  ({ id, name, system, role, parent, position, explode, shape, size, material: unknown, provenance: 'ILLUSTRATIVE', dimensions: notEstablished, notes })

const authoredParts: Part[] = [
  { ...part('chassis-node','Monocoque envelope','Chassis & structure','Central survival-cell envelope; SF-24-inspired packaging reference.','Vehicle structure',[-0.05,0.02,0],[0,0.28,0],'loft',[2.65,0.38,0.56],'Procedural reconstruction guided by public SF-24 imagery. Not official CAD or dimensionally accurate.'), sections:[{x:-1.2,y:0,width:0.28,height:0.22},{x:-0.75,y:0,width:0.38,height:0.38},{x:0,y:0,width:0.34,height:0.38},{x:0.62,y:0,width:0.3,height:0.34},{x:1.2,y:0,width:0.18,height:0.22}] },
  { ...part('floor-reference','Floor and underbody','Aerodynamics','Floor planform reference beneath the monocoque.','Aerodynamic package',[-0.1,-0.27,0],[0,-0.5,0],'loft',[2.9,0.08,1.12],'SF-24-inspired floor envelope only. Tunnel, fences, edge wing and diffuser are not reconstructed from proprietary data.'), sections:[{x:-1.45,y:0,width:0.52,height:0.06},{x:-0.8,y:0,width:0.56,height:0.07},{x:0,y:0,width:0.54,height:0.07},{x:0.85,y:0,width:0.52,height:0.07},{x:1.45,y:0,width:0.46,height:0.06}] },
  { ...part('nose-reference','Nose and front structure','Chassis & structure','Longitudinal nose envelope ahead of the survival cell.','Vehicle structure',[1.68,0.02,0],[0.38,0.15,0],'loft',[1.15,0.2,0.3],'Wide-nose visual reference informed by public SF-24 launch imagery; not a crash structure or homologation model.'), sections:[{x:-0.58,y:0,width:0.23,height:0.18},{x:-0.2,y:0,width:0.17,height:0.14},{x:0.2,y:0,width:0.12,height:0.11},{x:0.58,y:0,width:0.09,height:0.08}] },
  part('front-wing-reference','Front wing reference','Aerodynamics','Transverse front aerodynamic reference element.','Aerodynamic package',[2.12,-0.34,0],[0.35,-0.2,0],'box',[0.5,0.09,1.65],'Single simplified volume; no flap slots, endplates or aerodynamic performance are implied.'),
  { ...part('sidepod-left','Left sidepod — undercut / downwash','Aerodynamics','Sidepod body envelope with a pronounced front undercut and descending upper surface.','Aerodynamic package',[-0.25,-0.03,0.47],[-0.1,0.12,0.55],'loft',[0.92,0.3,0.42],'Concept informed by public SF-24 technical analysis. Surface shape is an illustrative reconstruction; cooling ducts and exact section geometry are unknown.'), sections:[{x:-0.5,y:-0.04,width:0.12,height:0.12},{x:-0.25,y:0.02,width:0.24,height:0.26},{x:0.05,y:0.05,width:0.25,height:0.27},{x:0.38,y:-0.01,width:0.2,height:0.2},{x:0.5,y:-0.07,width:0.12,height:0.12}] },
  { ...part('sidepod-right','Right sidepod — undercut / downwash','Aerodynamics','Mirrored sidepod body envelope with a pronounced front undercut and descending upper surface.','Aerodynamic package',[-0.25,-0.03,-0.47],[-0.1,0.12,-0.55],'loft',[0.92,0.3,0.42],'Concept informed by public SF-24 technical analysis. Surface shape is an illustrative reconstruction; cooling ducts and exact section geometry are unknown.'), sections:[{x:-0.5,y:-0.04,width:0.12,height:0.12},{x:-0.25,y:0.02,width:0.24,height:0.26},{x:0.05,y:0.05,width:0.25,height:0.27},{x:0.38,y:-0.01,width:0.2,height:0.2},{x:0.5,y:-0.07,width:0.12,height:0.12}] },
  { ...part('engine-cover-reference','Engine cover envelope','Powertrain','Upper bodywork enclosing the power-unit package.','Powertrain package',[-0.92,0.28,0],[0,-0.18,0],'loft',[0.95,0.42,0.42],'Public SF-24 visual reference only. Internal power unit, gearbox and cooling layouts are not represented.'), sections:[{x:-0.5,y:-0.04,width:0.18,height:0.18},{x:-0.2,y:0.02,width:0.22,height:0.35},{x:0.12,y:0.02,width:0.22,height:0.38},{x:0.5,y:-0.05,width:0.14,height:0.24}] },
  part('rear-wing-reference','Rear wing reference','Aerodynamics','Transverse rear aerodynamic reference element.','Aerodynamic package',[-1.72,0.62,0],[0,-0.25,0],'box',[0.32,0.08,1.18],'Single simplified volume; no DRS mechanism or aerodynamic performance is implied.'),
  part('front-upright','Front upright','Front suspension','Locates the wheel assembly and provides suspension and steering attachment interfaces.','Front corner assembly',[0.9,0,0.72],[1.25,0,0],'hub',[0.2,0.32,0.2],'Reference geometry only. No manufacturing dimensions are asserted.'),
  { ...part('upper-wishbone','Upper wishbone','Front suspension','Upper suspension link between chassis-side pivots and upright.','Front suspension',[0.12,0.42,0.36],[0,0.75,0],'rod',[0.05,0.05,0.05],'Conceptual A-arm representation; pivot coordinates are illustrative.'), segments:[[[-0.48,0.48,0.16],[0.9,0.34,0.64]],[[-0.48,0.48,0.56],[0.9,0.34,0.8]]] },
  { ...part('lower-wishbone','Lower wishbone','Front suspension','Lower suspension link controlling upright motion with the upper link.','Front suspension',[0.12,-0.42,0.36],[0,-0.75,0],'rod',[0.05,0.05,0.05],'Conceptual A-arm representation; pivot coordinates are illustrative.'), segments:[[[-0.48,-0.43,0.12],[0.9,-0.32,0.64]],[[-0.48,-0.43,0.6],[0.9,-0.32,0.8]]] },
  { ...part('push-rod','Push-rod','Front suspension','Transfers wheel/upright motion to an inboard spring-damper mechanism.','Front suspension',[0.48,0.03,0.5],[0.25,0.2,0.7],'rod',[0.04,0.04,0.04],'Simplified link; rocker and damper internals are not represented.'), segments:[[[0.58,-0.28,0.7],[0.02,0.82,0.18]]] },
  { ...part('brake-disc','Front brake disc reference','Braking system','Rotating friction-surface reference at the front corner; mounts to the front hub.','Front-left brake corner',[0.9,0,0.84],[0.2,0,0.62],'disc',[0.3,0.07,0.3],'Generic disc envelope. Material, ventilation and dimensions are unknown.'), rotation:[0,Math.PI/2,0] },
  { ...part('front-hub','Front hub & wheel interface','Front suspension','Rotating hub carried in the upright bearing; carries the rotor and locates the wheel.','Front-left brake corner',[0.9,0,0.79],[0.12,0,0.4],'hub',[0.07,0.22,0.07],'Illustrative spindle envelope. Bearing type, wheel-nut interface and all dimensions are not established.'), rotation:[Math.PI/2,0,0] },
  part('caliper-mount','Caliper mounting bracket','Braking system','Carrier that locates the caliper on the upright.','Front-left brake corner',[0.9,0.17,0.76],[0.05,0.4,0.12],'box',[0.1,0.13,0.04],'Illustrative bracket. Real mounting arrangements (radial or axial bolting) and hardpoints are unknown.'),
  part('brake-caliper','Brake caliper body','Braking system','Fixed caliper straddling the rotor; houses the pistons and carries the pads.','Front-left brake corner',[0.9,0.25,0.84],[0.05,0.58,0.36],'box',[0.27,0.09,0.17],'Single straddling envelope. Piston count, bore sizes, material and stiffness are unknown; no SF-24 caliper data is used.'),
  part('pad-inner-backing','Inner pad backing plate','Braking system','Steel carrier for the inner friction lining; reacts piston load.','Front-left brake corner',[0.9,0.25,0.782],[0.04,0.36,0.08],'box',[0.21,0.075,0.01],'Illustrative plate. Thickness and material are not established.'),
  part('pad-inner','Inner brake pad lining','Braking system','Friction lining bonded to the inner backing plate; bears on the inboard rotor face.','Front-left brake corner',[0.9,0.25,0.797],[0.04,0.3,0.16],'box',[0.2,0.07,0.016],'Illustrative lining. Compound, friction coefficient and wear limits are unknown.'),
  part('pad-outer','Outer brake pad lining','Braking system','Friction lining bonded to the outer backing plate; bears on the outboard rotor face.','Front-left brake corner',[0.9,0.25,0.883],[0.04,0.3,0.58],'box',[0.2,0.07,0.016],'Illustrative lining. Compound, friction coefficient and wear limits are unknown.'),
  part('pad-outer-backing','Outer pad backing plate','Braking system','Steel carrier for the outer friction lining; reacts piston load.','Front-left brake corner',[0.9,0.25,0.898],[0.04,0.36,0.66],'box',[0.21,0.075,0.01],'Illustrative plate. Thickness and material are not established.'),
  part('wheel-tyre','Front-left wheel & tyre','Wheels & tyres','Front-left tyre and wheel reference volume.','Front corner assembly',[0.9,0,0.96],[0.25,0,0.95],'wheel',[0.48,0.16,0.48],'Generic study geometry. No tyre compound, rim specification or dimensional claim.'),
  part('front-right-wheel','Front-right wheel & tyre','Wheels & tyres','Opposite front tyre and wheel reference volume.','Front corner assembly',[0.9,0,-0.96],[0.25,0,-0.95],'wheel',[0.48,0.16,0.48],'Generic study geometry; no detailed opposite-side suspension is included yet.'),
  part('rear-left-wheel','Rear-left wheel & tyre','Wheels & tyres','Rear-left tyre and wheel reference volume.','Rear corner assembly',[-1.22,0,0.94],[-0.25,0,0.95],'wheel',[0.53,0.18,0.53],'Generic study geometry; rear suspension and brake internals are not modelled.'),
  part('rear-right-wheel','Rear-right wheel & tyre','Wheels & tyres','Rear-right tyre and wheel reference volume.','Rear corner assembly',[-1.22,0,-0.94],[-0.25,0,-0.95],'wheel',[0.53,0.18,0.53],'Generic study geometry; rear suspension and brake internals are not modelled.'),
  part('rear-upright','Rear upright reference','Rear suspension','Rear wheel carrier and suspension interface envelope.','Rear corner assembly',[-1.22,0,0.72],[-1.15,0,0.7],'hub',[0.2,0.34,0.2],'Illustrative rear upright. Public SF-24 layout references are used; exact pickup geometry is unknown.'),
  { ...part('rear-upper-link-front','Rear upper link — forward','Rear suspension','Forward upper link in the rear multi-link arrangement.','Rear suspension',[-0.95,0.42,0.38],[-0.2,0.75,0.2],'rod',[0.04,0.04,0.04],'Public technical analysis describes separate upper arms; pickup coordinates are reconstructed illustratively.'), segments:[[[-0.3,0.46,0.12],[-1.22,0.3,0.72]]] },
  { ...part('rear-upper-link-rear','Rear upper link — rearward','Rear suspension','Rearward upper link in the rear multi-link arrangement.','Rear suspension',[-1.42,0.42,0.38],[-0.4,0.75,0.2],'rod',[0.04,0.04,0.04],'Public technical analysis describes separate upper arms rather than a conventional converging wishbone; exact geometry unknown.'), segments:[[[-1.75,0.46,0.12],[-1.22,0.3,0.72]]] },
  { ...part('rear-pull-rod','Rear pull-rod','Rear suspension','Pull-rod link connecting the rear upright region to the inboard suspension mechanism.','Rear suspension',[-1.12,-0.12,0.5],[-0.2,-0.4,0.65],'rod',[0.04,0.04,0.04],'SF-24 retained a pull-rod rear layout. This link is an illustrative reconstruction, not measured geometry.'), segments:[[[-1.22,-0.25,0.72],[-0.65,0.45,0.22]]] },
  { ...part('rear-lower-link','Rear lower link','Rear suspension','Lower rear suspension link between chassis and upright.','Rear suspension',[-1.1,-0.38,0.4],[-0.2,-0.7,0.25],'rod',[0.04,0.04,0.04],'Illustrative rear lower link; actual multi-link pickup positions and dimensions are unknown.'), segments:[[[-0.42,-0.38,0.18],[-1.22,-0.3,0.72]]] },
  part('steering-rack','Steering rack','Steering','Transverse rack converting pinion rotation into tie-rod travel.','Steering system',[0.78, 0.05, 0],[0.15, 0.25, 0],'box',[0.06, 0.06, 0.9],'Illustrative rack envelope. Rack ratio, travel and mounting positions are unknown.'),
  { ...part('steering-column','Steering column','Steering','Transfers steering-wheel input to the rack pinion.','Steering system',[0,0,0],[0,0.45,0],'rod',[0.03,0.03,0.03],'Illustrative column line; universal joints and steering wheel are not modelled.'), segments:[[[0.78,0.08,0],[0.15,0.32,0]]] },
  { ...part('tie-rod-left','Front-left steering tie rod','Steering','Links the rack end to the upright steering arm.','Steering system',[0,0,0],[0.1,0.15,0.35],'rod',[0.03,0.03,0.03],'Illustrative link; steering arm position and Ackermann geometry are unknown.'), segments:[[[0.78,0.05,0.45],[0.86,0.05,0.72]]] },
  { ...part('tie-rod-right','Front-right steering tie rod','Steering','Links the rack end to the upright steering arm.','Steering system',[0,0,0],[0.1,0.15,-0.35],'rod',[0.03,0.03,0.03],'Illustrative link; steering arm position and Ackermann geometry are unknown.'), segments:[[[0.78,0.05,-0.45],[0.86,0.05,-0.72]]] },
  part('front-rocker-left','Front-left rocker','Front suspension','Bell crank converting push-rod motion into spring-damper motion.','Front spring-damper unit',[0.02,0.82,0.18],[0,0.45,0.25],'box',[0.08, 0.05, 0.08],'Illustrative envelope. Pivot location and motion ratio are unknown.'),
  { ...part('front-damper-left','Front-left damper','Front suspension','Inboard spring-damper unit actuated by the rocker.','Front spring-damper unit',[0,0,0],[0,0.6,0.15],'rod',[0.03,0.03,0.03],'Illustrative line of action. Spring rate, damping characteristics and installation ratio are unknown.'), segments:[[[0.02,0.82,0.18],[-0.4,0.74,0.06]]] },
  part('rear-rocker-left','Rear-left rocker','Rear suspension','Bell crank converting pull-rod motion into spring-damper motion.','Rear spring-damper unit',[-0.65,0.45,0.22],[0,0.45,0.25],'box',[0.08, 0.05, 0.08],'Illustrative envelope. Pivot location and motion ratio are unknown.'),
  { ...part('rear-damper-left','Rear-left damper','Rear suspension','Inboard spring-damper unit actuated by the rocker.','Rear spring-damper unit',[0,0,0],[0,0.6,0.15],'rod',[0.03,0.03,0.03],'Illustrative line of action. Spring rate, damping characteristics and installation ratio are unknown.'), segments:[[[-0.65,0.45,0.22],[-0.3,0.42,0.06]]] },
  part('front-rocker-right','Front-right rocker','Front suspension','Bell crank converting push-rod motion into spring-damper motion.','Front spring-damper unit',[0.02,0.82,-0.18],[0,0.45,-0.25],'box',[0.08, 0.05, 0.08],'Illustrative envelope. Pivot location and motion ratio are unknown.'),
  { ...part('front-damper-right','Front-right damper','Front suspension','Inboard spring-damper unit actuated by the rocker.','Front spring-damper unit',[0,0,0],[0,0.6,-0.15],'rod',[0.03,0.03,0.03],'Illustrative line of action. Spring rate, damping characteristics and installation ratio are unknown.'), segments:[[[0.02,0.82,-0.18],[-0.4,0.74,-0.06]]] },
  part('rear-rocker-right','Rear-right rocker','Rear suspension','Bell crank converting pull-rod motion into spring-damper motion.','Rear spring-damper unit',[-0.65,0.45,-0.22],[0,0.45,-0.25],'box',[0.08, 0.05, 0.08],'Illustrative envelope. Pivot location and motion ratio are unknown.'),
  { ...part('rear-damper-right','Rear-right damper','Rear suspension','Inboard spring-damper unit actuated by the rocker.','Rear spring-damper unit',[0,0,0],[0,0.6,-0.15],'rod',[0.03,0.03,0.03],'Illustrative line of action. Spring rate, damping characteristics and installation ratio are unknown.'), segments:[[[-0.65,0.45,-0.22],[-0.3,0.42,-0.06]]] },
  part('master-cylinder-front','Front brake master cylinder','Braking system','Converts pedal force into hydraulic pressure for the front circuit.','Brake hydraulics',[1.06, 0.14, 0.07],[0.35, 0.3, 0.1],'box',[0.12, 0.05, 0.05],'Illustrative envelope. Bore size, pedal ratio and brake-balance mechanism are unknown.'),
  part('master-cylinder-rear','Rear brake master cylinder','Braking system','Converts pedal force into hydraulic pressure for the rear circuit.','Brake hydraulics',[1.06, 0.14, -0.07],[0.35, 0.3, -0.1],'box',[0.12, 0.05, 0.05],'Illustrative envelope. Bore size and the rear brake-by-wire arrangement are unknown.'),
]

function deriveCorner(source: Part[], spec: CornerSpec): Part[] {
  const derived: Part[] = []
  for (const entry of spec.entries) {
    if (entry.existing) continue
    const base = source.find((item) => item.id === entry.source)
    if (!base) throw new Error('Corner ' + spec.code + ': missing source component ' + entry.source)
    const rear = spec.code.startsWith('r') && base.system.startsWith('Front ')
    derived.push({
      ...base,
      id: entry.id,
      name: entry.name,
      system: rear ? base.system.replace('Front ', 'Rear ') : base.system,
      parent: base.parent.replace(/^(Front-left|Rear-left|Front|Rear)\b[^,]*/, spec.corner + ' corner assembly'),
      position: spec.transform(base.position),
      explode: spec.transformExplode(base.explode),
      rotation: base.rotation && spec.transformRotation(base.rotation),
      segments: base.segments?.map(([from, to]) => [spec.transform(from), spec.transform(to)] as [Vec3, Vec3]),
    })
  }
  return derived
}

/** Authored parts followed by the three derived corners (see corners.ts). */
export const parts: Part[] = cornerSpecs.reduce((list, spec) => [...list, ...deriveCorner(list, spec)], authoredParts)

export const provenanceLabel = (value: Provenance) => value === 'ILLUSTRATIVE' ? 'Illustrative' : 'Unknown'
