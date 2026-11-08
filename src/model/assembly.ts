import { parts } from './components'

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
 i('pushrod-in','push-rod','Inboard rocker pickup','chassis-node','CONCEPTUAL'),
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
 'rear-upright':['rear-upper-link-front','rear-upper-link-rear','rear-pull-rod','rear-lower-link','rear-left-wheel','rear-right-wheel'],
}
export function validateAssemblyModel(): string[] {
 const ids=new Set(parts.map(part=>part.id)); const errors:string[]=[]
 for(const edge of interfaces){if(!ids.has(edge.ownerId))errors.push('Missing interface owner: '+edge.ownerId);if(!ids.has(edge.targetId))errors.push('Missing interface target: '+edge.targetId)}
 for(const [owner,targets] of Object.entries(dependencies)){if(!ids.has(owner))errors.push('Missing dependency owner: '+owner);for(const target of targets)if(!ids.has(target))errors.push('Missing dependency target: '+target)}
 return errors
}
export const installPrerequisites: Record<string,string[]> = {
 'chassis-node':[], 'floor-reference':['chassis-node'], 'nose-reference':['chassis-node'],
 'front-wing-reference':['nose-reference'], 'sidepod-left':['chassis-node'], 'sidepod-right':['chassis-node'],
 'engine-cover-reference':['chassis-node'], 'rear-wing-reference':['engine-cover-reference'],
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
export function getRemovalBlockers(id:string, installed:string[]):string[]{return installed.filter(item=>(installPrerequisites[item]??[]).includes(id))}
export function getInstallationBlockers(id:string, installed:string[]):string[]{return (installPrerequisites[id]??[]).filter(item=>!installed.includes(item))}
export function validateInstalledSet(installed:string[]):string[]{const errors:string[]=[];for(const id of installed)for(const req of installPrerequisites[id]??[])if(!installed.includes(req))errors.push(id+' requires '+req);return errors}

/** Components whose removal must precede removing `id`, transitively, ordered so each can be removed in turn. */
export function getRemovalSequence(id:string, installed:string[]):string[]{
 const order:string[]=[]; const visit=(target:string)=>{for(const blocker of getRemovalBlockers(target,installed)){if(!order.includes(blocker)){visit(blocker);order.push(blocker)}}}
 visit(id); return order
}
