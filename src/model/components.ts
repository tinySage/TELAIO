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
}

const unknown = 'Unspecified'
const notEstablished = 'Not established'
const part = (id: string, name: string, system: string, role: string, parent: string, position: Vec3, explode: Vec3, shape: Part['shape'], size: Vec3, notes: string): Part =>
  ({ id, name, system, role, parent, position, explode, shape, size, material: unknown, provenance: 'ILLUSTRATIVE', dimensions: notEstablished, notes })

export const parts: Part[] = [
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
  part('brake-disc','Front brake disc reference','Braking system','Rotating friction-surface reference at the front corner.','Front corner assembly',[1.02,0,0.78],[0.65,0,0.65],'disc',[0.3,0.07,0.3],'Generic disc envelope. Material, ventilation and dimensions are unknown.'),
  part('wheel-tyre','Front-left wheel & tyre','Wheels & tyres','Front-left tyre and wheel reference volume.','Front corner assembly',[1.2,0,0.96],[1.6,0,0.2],'wheel',[0.48,0.16,0.48],'Generic study geometry. No tyre compound, rim specification or dimensional claim.'),
  part('front-right-wheel','Front-right wheel & tyre','Wheels & tyres','Opposite front tyre and wheel reference volume.','Front corner assembly',[1.2,0,-0.96],[1.6,0,-0.2],'wheel',[0.48,0.16,0.48],'Generic study geometry; no detailed opposite-side suspension is included yet.'),
  part('rear-left-wheel','Rear-left wheel & tyre','Wheels & tyres','Rear-left tyre and wheel reference volume.','Rear corner assembly',[-1.28,0,0.94],[-1.2,0,0.35],'wheel',[0.53,0.18,0.53],'Generic study geometry; rear suspension and brake internals are not modelled.'),
  part('rear-right-wheel','Rear-right wheel & tyre','Wheels & tyres','Rear-right tyre and wheel reference volume.','Rear corner assembly',[-1.28,0,-0.94],[-1.2,0,-0.35],'wheel',[0.53,0.18,0.53],'Generic study geometry; rear suspension and brake internals are not modelled.'),
  part('rear-upright','Rear upright reference','Rear suspension','Rear wheel carrier and suspension interface envelope.','Rear corner assembly',[-1.22,0,0.72],[-1.15,0,0.7],'hub',[0.2,0.34,0.2],'Illustrative rear upright. Public SF-24 layout references are used; exact pickup geometry is unknown.'),
  { ...part('rear-upper-link-front','Rear upper link — forward','Rear suspension','Forward upper link in the rear multi-link arrangement.','Rear suspension',[-0.95,0.42,0.38],[-0.2,0.75,0.2],'rod',[0.04,0.04,0.04],'Public technical analysis describes separate upper arms; pickup coordinates are reconstructed illustratively.'), segments:[[[-0.3,0.46,0.12],[-1.22,0.3,0.72]]] },
  { ...part('rear-upper-link-rear','Rear upper link — rearward','Rear suspension','Rearward upper link in the rear multi-link arrangement.','Rear suspension',[-1.42,0.42,0.38],[-0.4,0.75,0.2],'rod',[0.04,0.04,0.04],'Public technical analysis describes separate upper arms rather than a conventional converging wishbone; exact geometry unknown.'), segments:[[[-1.75,0.46,0.12],[-1.22,0.3,0.72]]] },
  { ...part('rear-pull-rod','Rear pull-rod','Rear suspension','Pull-rod link connecting the rear upright region to the inboard suspension mechanism.','Rear suspension',[-1.12,-0.12,0.5],[-0.2,-0.4,0.65],'rod',[0.04,0.04,0.04],'SF-24 retained a pull-rod rear layout. This link is an illustrative reconstruction, not measured geometry.'), segments:[[[-1.22,-0.25,0.72],[-0.65,0.45,0.22]]] },
  { ...part('rear-lower-link','Rear lower link','Rear suspension','Lower rear suspension link between chassis and upright.','Rear suspension',[-1.1,-0.38,0.4],[-0.2,-0.7,0.25],'rod',[0.04,0.04,0.04],'Illustrative rear lower link; actual multi-link pickup positions and dimensions are unknown.'), segments:[[[-0.42,-0.38,0.18],[-1.22,-0.3,0.72]]] },
]

export const provenanceLabel = (value: Provenance) => value === 'ILLUSTRATIVE' ? 'Illustrative' : 'Unknown'
