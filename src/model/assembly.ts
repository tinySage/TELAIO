import { parts } from './components'
import { cornerSpecs, mapCornerId } from './corners'

export type InterfaceType = 'PIVOT' | 'MOUNT' | 'COAXIAL' | 'CONTACT' | 'CONCEPTUAL'
export type ComponentInterface = { id: string; ownerId: string; label: string; targetId: string; type: InterfaceType; status: 'CONCEPTUAL' | 'DEFINED' }
const i = (id: string, ownerId: string, label: string, targetId: string, type: InterfaceType): ComponentInterface => ({ id, ownerId, label, targetId, type, status: 'CONCEPTUAL' })
export const interfaces: ComponentInterface[] = [
 i('upright-upper','front-upright','Upper wishbone outboard joint','upper-wishbone','PIVOT'),
 i('upright-lower','front-upright','Lower wishbone outboard joint','lower-wishbone','PIVOT'),
 i('upright-hub','front-upright','Hub bearing bore','front-hub','COAXIAL'),
 i('upright-caliper-mount','front-upright','Caliper bracket mounting face','caliper-mount','MOUNT'),
 i('upper-in-a','upper-wishbone','Inboard pivot A','chassis-node','PIVOT'),
 i('upper-in-b','upper-wishbone','Inboard pivot B','chassis-node','PIVOT'),
 i('upper-out','upper-wishbone','Outboard ball joint','front-upright','PIVOT'),
 i('lower-in-a','lower-wishbone','Inboard pivot A','chassis-node','PIVOT'),
 i('lower-in-b','lower-wishbone','Inboard pivot B','chassis-node','PIVOT'),
 i('lower-out','lower-wishbone','Outboard ball joint','front-upright','PIVOT'),
 i('pushrod-out','push-rod','Outboard pickup','front-upright','PIVOT'),
 i('pushrod-in','push-rod','Inboard rocker pickup','front-rocker-left','PIVOT'),
 i('hub-bearing','front-hub','Bearing axis','front-upright','COAXIAL'),
 i('hub-rotor','front-hub','Rotor bell mounting face','brake-disc','MOUNT'),
 i('hub-wheel','front-hub','Wheel centring and retention','wheel-tyre','COAXIAL'),
 i('disc-hub','brake-disc','Rotor mounting interface','front-hub','MOUNT'),
 i('mount-caliper','caliper-mount','Caliper mounting bolts','brake-caliper','MOUNT'),
 i('caliper-mount-face','brake-caliper','Mounting lugs','caliper-mount','MOUNT'),
 i('caliper-inner-pad','brake-caliper','Inner piston bank','pad-inner-backing','CONTACT'),
 i('caliper-outer-pad','brake-caliper','Outer piston bank','pad-outer-backing','CONTACT'),
 i('inner-backing-lining','pad-inner-backing','Lining bond face','pad-inner','MOUNT'),
 i('outer-backing-lining','pad-outer-backing','Lining bond face','pad-outer','MOUNT'),
 i('inner-lining-rotor','pad-inner','Inboard friction contact','brake-disc','CONTACT'),
 i('outer-lining-rotor','pad-outer','Outboard friction contact','brake-disc','CONTACT'),
 i('wheel-bearing','wheel-tyre','Hub centring axis','front-hub','COAXIAL'),
 i('rear-link-front','rear-upper-link-front','Forward upper link pickup','rear-upright','PIVOT'),
 i('rear-link-rear','rear-upper-link-rear','Rearward upper link pickup','rear-upright','PIVOT'),
 i('rear-pullrod-joint','rear-pull-rod','Rear pull-rod pickup','rear-upright','PIVOT'),
 i('rear-lower-joint','rear-lower-link','Rear lower link pickup','rear-upright','PIVOT'),
]
export const dependencies: Record<string, string[]> = {
 'front-upright':['upper-wishbone','lower-wishbone','front-hub','caliper-mount'],
 'front-hub':['front-upright','brake-disc','wheel-tyre'],
 'caliper-mount':['front-upright','brake-caliper'],
 'brake-caliper':['caliper-mount','pad-inner-backing','pad-outer-backing','brake-disc'],
 'pad-inner-backing':['brake-caliper','pad-inner'],
 'pad-outer-backing':['brake-caliper','pad-outer'],
 'pad-inner':['pad-inner-backing','brake-disc'],
 'pad-outer':['pad-outer-backing','brake-disc'],
 'upper-wishbone':['chassis-node','front-upright'],
 'lower-wishbone':['chassis-node','front-upright'],
 'push-rod':['front-upright','chassis-node'],
 'brake-disc':['front-hub','pad-inner','pad-outer'],
 'wheel-tyre':['front-hub'],
 'chassis-node':['upper-wishbone','lower-wishbone','push-rod','rear-upper-link-front','rear-upper-link-rear','rear-pull-rod','rear-lower-link'],
 'rear-upright':['rear-upper-link-front','rear-upper-link-rear','rear-pull-rod','rear-lower-link','rear-left-wheel'],
}

function mergeRelations(record: Record<string, string[]>, id: string, targets: string[]) {
 record[id] = [...new Set([...(record[id] ?? []), ...targets])]
}
// Derive the other three corners' interfaces, dependencies and install prerequisites from the
// authored corners, in the same order the parts are derived (see corners.ts).
for (const spec of cornerSpecs) {
 for (const edge of [...interfaces]) {
  const ownerId = mapCornerId(spec, edge.ownerId), targetId = mapCornerId(spec, edge.targetId)
  if (!ownerId || !targetId || !spec.entries.some((entry) => entry.source === edge.ownerId)) continue
  interfaces.push({ ...edge, id: spec.code + '-' + edge.id, ownerId, targetId })
 }
 for (const entry of spec.entries) {
  const map = (ids: string[] | undefined) => (ids ?? []).flatMap((id) => mapCornerId(spec, id) ?? [])
  mergeRelations(dependencies, entry.id, map(dependencies[entry.source]))
 }
}

export function validateAssemblyModel(): string[] {
 const ids=new Set(parts.map(part=>part.id)); const errors:string[]=[]
 for(const edge of interfaces){if(!ids.has(edge.ownerId))errors.push('Missing interface owner: '+edge.ownerId);if(!ids.has(edge.targetId))errors.push('Missing interface target: '+edge.targetId)}
 for(const [owner,targets] of Object.entries(dependencies)){if(!ids.has(owner))errors.push('Missing dependency owner: '+owner);for(const target of targets)if(!ids.has(target))errors.push('Missing dependency target: '+target)}
 return errors
}
export const installPrerequisites: Record<string,string[]> = {
 'chassis-node':[], 'front-bulkhead':['chassis-node'], 'roll-hoop':['chassis-node'], 'halo':['chassis-node'],
 'floor-reference':['chassis-node'], 'diffuser':['floor-reference'], 'nose-reference':['front-bulkhead'],
 'front-wing-reference':['nose-reference'],
 // Sidepod bodywork comes off before the radiators it encloses.
 'radiator-left':['chassis-node'], 'radiator-right':['chassis-node'],
 'sidepod-left':['chassis-node','radiator-left'], 'sidepod-right':['chassis-node','radiator-right'],
 // Power unit is a stressed member: survival cell → engine → gearbox → differential.
 'engine':['chassis-node'], 'gearbox':['engine'], 'differential':['gearbox'],
 'driveshaft-left':['differential','rear-left-hub'], 'driveshaft-right':['differential','rear-right-hub'],
 'engine-cover-reference':['chassis-node','engine','roll-hoop'],
 // The rear wing is carried on the gearbox and rear crash structure.
 'rear-wing-reference':['gearbox'],
 'front-upright':['chassis-node'], 'upper-wishbone':['chassis-node','front-upright'],
 'lower-wishbone':['chassis-node','front-upright'], 'push-rod':['chassis-node','front-upright'],
 'front-hub':['front-upright'],
 'brake-disc':['front-hub'],
 'caliper-mount':['front-upright'],
 // The caliper straddles the rotor, so the rotor must be fitted first.
 'brake-caliper':['caliper-mount','brake-disc'],
 'pad-inner-backing':['brake-caliper'], 'pad-outer-backing':['brake-caliper'],
 'pad-inner':['pad-inner-backing'], 'pad-outer':['pad-outer-backing'],
 // The wheel must come off before any brake service.
 'wheel-tyre':['front-hub','brake-disc','brake-caliper','pad-inner','pad-outer'],
 'front-right-wheel':['chassis-node'], 'rear-left-wheel':['chassis-node'], 'rear-right-wheel':['chassis-node'],
 'rear-upright':['chassis-node'],
 'rear-upper-link-front':['chassis-node','rear-upright'],
 'rear-upper-link-rear':['chassis-node','rear-upright'],
 'rear-pull-rod':['chassis-node','rear-upright'],
 'rear-lower-link':['chassis-node','rear-upright'],
}
for (const spec of cornerSpecs) for (const entry of spec.entries) {
 installPrerequisites[entry.id] = [...new Set([...(installPrerequisites[entry.id] ?? []), ...(installPrerequisites[entry.source] ?? []).flatMap((id) => mapCornerId(spec, id) ?? [])])]
}

// Steering, spring-damper units and brake hydraulics (authored per side; not corner-derived).
const runningGear: { prerequisites: Record<string,string[]>; dependencies: Record<string,string[]>; interfaces: ComponentInterface[] } = {
 prerequisites: {
  'steering-rack':['chassis-node'], 'steering-column':['chassis-node','steering-rack'],
  'tie-rod-left':['steering-rack','front-upright'], 'tie-rod-right':['steering-rack','front-right-upright'],
  'front-rocker-left':['chassis-node'], 'front-rocker-right':['chassis-node'],
  'front-damper-left':['chassis-node','front-rocker-left'], 'front-damper-right':['chassis-node','front-rocker-right'],
  'rear-rocker-left':['chassis-node'], 'rear-rocker-right':['chassis-node'],
  'rear-damper-left':['chassis-node','rear-rocker-left'], 'rear-damper-right':['chassis-node','rear-rocker-right'],
  'push-rod':['front-rocker-left'], 'front-right-push-rod':['front-rocker-right'],
  'rear-pull-rod':['rear-rocker-left'], 'rear-right-pull-rod':['rear-rocker-right'],
  'master-cylinder-front':['chassis-node'], 'master-cylinder-rear':['chassis-node'],
 },
 dependencies: {
  'steering-rack':['chassis-node','steering-column','tie-rod-left','tie-rod-right'], 'steering-column':['steering-rack'],
  'tie-rod-left':['steering-rack','front-upright'], 'tie-rod-right':['steering-rack','front-right-upright'],
  'front-rocker-left':['chassis-node','push-rod','front-damper-left'], 'front-rocker-right':['chassis-node','front-right-push-rod','front-damper-right'],
  'front-damper-left':['front-rocker-left','chassis-node'], 'front-damper-right':['front-rocker-right','chassis-node'],
  'rear-rocker-left':['chassis-node','rear-pull-rod','rear-damper-left'], 'rear-rocker-right':['chassis-node','rear-right-pull-rod','rear-damper-right'],
  'rear-damper-left':['rear-rocker-left','chassis-node'], 'rear-damper-right':['rear-rocker-right','chassis-node'],
  'master-cylinder-front':['chassis-node','brake-caliper','front-right-brake-caliper'],
  'master-cylinder-rear':['chassis-node','rear-left-brake-caliper','rear-right-brake-caliper'],
 },
 interfaces: [
  i('rack-mount','steering-rack','Rack mounting','chassis-node','MOUNT'),
  i('column-pinion','steering-column','Pinion engagement','steering-rack','PIVOT'),
  i('tie-rod-left-inner','tie-rod-left','Inner ball joint','steering-rack','PIVOT'), i('tie-rod-left-outer','tie-rod-left','Steering arm joint','front-upright','PIVOT'),
  i('tie-rod-right-inner','tie-rod-right','Inner ball joint','steering-rack','PIVOT'), i('tie-rod-right-outer','tie-rod-right','Steering arm joint','front-right-upright','PIVOT'),
  i('fr-pushrod-in','front-right-push-rod','Inboard rocker pickup','front-rocker-right','PIVOT'),
  i('rear-pullrod-in','rear-pull-rod','Inboard rocker pickup','rear-rocker-left','PIVOT'),
  i('rr-pullrod-in','rear-right-pull-rod','Inboard rocker pickup','rear-rocker-right','PIVOT'),
  ...(['front','rear'] as const).flatMap((axle) => (['left','right'] as const).flatMap((side) => [
   i(axle+'-rocker-'+side+'-pivot',axle+'-rocker-'+side,'Rocker pivot','chassis-node','PIVOT'),
   i(axle+'-damper-'+side+'-rocker',axle+'-damper-'+side,'Rocker end eye',axle+'-rocker-'+side,'PIVOT'),
   i(axle+'-damper-'+side+'-chassis',axle+'-damper-'+side,'Chassis end eye','chassis-node','MOUNT'),
  ])),
  i('mc-front-mount','master-cylinder-front','Pedal box mounting','chassis-node','MOUNT'),
  i('mc-rear-mount','master-cylinder-rear','Pedal box mounting','chassis-node','MOUNT'),
  i('mc-front-fl','master-cylinder-front','Front hydraulic circuit','brake-caliper','CONCEPTUAL'),
  i('mc-front-fr','master-cylinder-front','Front hydraulic circuit','front-right-brake-caliper','CONCEPTUAL'),
  i('mc-rear-rl','master-cylinder-rear','Rear hydraulic circuit','rear-left-brake-caliper','CONCEPTUAL'),
  i('mc-rear-rr','master-cylinder-rear','Rear hydraulic circuit','rear-right-brake-caliper','CONCEPTUAL'),
 ],
}
// Chassis structure, powertrain, cooling and bodywork (Phase 10, part 2).
const vehicleSystems: { dependencies: Record<string,string[]>; interfaces: ComponentInterface[] } = {
 dependencies: {
  'front-bulkhead':['chassis-node','nose-reference'], 'roll-hoop':['chassis-node','engine-cover-reference'], 'halo':['chassis-node'],
  'engine':['chassis-node','gearbox','radiator-left','radiator-right'], 'gearbox':['engine','differential','rear-wing-reference'],
  'differential':['gearbox','driveshaft-left','driveshaft-right'],
  'driveshaft-left':['differential','rear-left-hub'], 'driveshaft-right':['differential','rear-right-hub'],
  'radiator-left':['chassis-node','sidepod-left','engine'], 'radiator-right':['chassis-node','sidepod-right','engine'],
  'floor-reference':['chassis-node','diffuser'], 'diffuser':['floor-reference'],
  'nose-reference':['front-bulkhead','front-wing-reference'], 'front-wing-reference':['nose-reference'],
  'sidepod-left':['chassis-node','radiator-left'], 'sidepod-right':['chassis-node','radiator-right'],
  'engine-cover-reference':['chassis-node','engine','roll-hoop'], 'rear-wing-reference':['gearbox'],
 },
 interfaces: [
  i('bulkhead-tub','front-bulkhead','Survival cell bond line','chassis-node','MOUNT'),
  i('rollhoop-tub','roll-hoop','Survival cell mounting','chassis-node','MOUNT'),
  i('halo-front','halo','Front pillar mounting','chassis-node','MOUNT'),
  i('halo-rear','halo','Rear side mountings','chassis-node','MOUNT'),
  i('engine-tub','engine','Survival cell mounting studs','chassis-node','MOUNT'),
  i('gearbox-engine','gearbox','Bellhousing to engine','engine','MOUNT'),
  i('diff-gearbox','differential','Final drive housing','gearbox','COAXIAL'),
  i('driveshaft-left-inner','driveshaft-left','Inboard joint','differential','COAXIAL'), i('driveshaft-left-outer','driveshaft-left','Outboard joint','rear-left-hub','COAXIAL'),
  i('driveshaft-right-inner','driveshaft-right','Inboard joint','differential','COAXIAL'), i('driveshaft-right-outer','driveshaft-right','Outboard joint','rear-right-hub','COAXIAL'),
  i('radiator-left-mount','radiator-left','Sidepod structure mounting','chassis-node','MOUNT'), i('radiator-left-circuit','radiator-left','Cooling circuit','engine','CONCEPTUAL'),
  i('radiator-right-mount','radiator-right','Sidepod structure mounting','chassis-node','MOUNT'), i('radiator-right-circuit','radiator-right','Cooling circuit','engine','CONCEPTUAL'),
  i('floor-tub','floor-reference','Floor fixings','chassis-node','MOUNT'),
  i('diffuser-floor','diffuser','Floor trailing edge','floor-reference','MOUNT'),
  i('nose-bulkhead','nose-reference','Nose mounting pins','front-bulkhead','MOUNT'),
  i('frontwing-nose','front-wing-reference','Front wing mounting','nose-reference','MOUNT'),
  i('sidepod-left-tub','sidepod-left','Bodywork fixings','chassis-node','MOUNT'), i('sidepod-left-airflow','sidepod-left','Inlet airflow to radiator','radiator-left','CONCEPTUAL'),
  i('sidepod-right-tub','sidepod-right','Bodywork fixings','chassis-node','MOUNT'), i('sidepod-right-airflow','sidepod-right','Inlet airflow to radiator','radiator-right','CONCEPTUAL'),
  i('cover-tub','engine-cover-reference','Bodywork fixings','chassis-node','MOUNT'),
  i('cover-airbox','engine-cover-reference','Airbox interface','roll-hoop','CONCEPTUAL'),
  i('rearwing-gearbox','rear-wing-reference','Wing pylon to gearbox / crash structure','gearbox','MOUNT'),
 ],
}
for (const [id, targets] of Object.entries(vehicleSystems.dependencies)) mergeRelations(dependencies, id, targets)
interfaces.push(...vehicleSystems.interfaces)
for (const [id, targets] of Object.entries(runningGear.prerequisites)) installPrerequisites[id] = [...new Set([...(installPrerequisites[id] ?? []), ...targets])]
for (const [id, targets] of Object.entries(runningGear.dependencies)) mergeRelations(dependencies, id, targets)
interfaces.push(...runningGear.interfaces)

export function getRemovalBlockers(id:string, installed:string[]):string[]{return installed.filter(item=>(installPrerequisites[item]??[]).includes(id))}
export function getInstallationBlockers(id:string, installed:string[]):string[]{return (installPrerequisites[id]??[]).filter(item=>!installed.includes(item))}
export function validateInstalledSet(installed:string[]):string[]{const errors:string[]=[];for(const id of installed)for(const req of installPrerequisites[id]??[])if(!installed.includes(req))errors.push(id+' requires '+req);return errors}

/** Components whose removal must precede removing `id`, transitively, ordered so each can be removed in turn. */
export function getRemovalSequence(id:string, installed:string[]):string[]{
 const order:string[]=[]; const visit=(target:string)=>{for(const blocker of getRemovalBlockers(target,installed)){if(!order.includes(blocker)){visit(blocker);order.push(blocker)}}}
 visit(id); return order
}
