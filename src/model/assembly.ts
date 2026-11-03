import { parts } from './components'

export type InterfaceType = 'PIVOT' | 'MOUNT' | 'COAXIAL' | 'CONTACT' | 'CONCEPTUAL'
export type ComponentInterface = {
  id: string
  ownerId: string
  label: string
  targetId: string
  type: InterfaceType
  status: 'CONCEPTUAL' | 'DEFINED'
}

const i = (id: string, ownerId: string, label: string, targetId: string, type: InterfaceType): ComponentInterface =>
  ({ id, ownerId, label, targetId, type, status: 'CONCEPTUAL' })

export const interfaces: ComponentInterface[] = [
  i('upright-upper','front-upright','Upper wishbone outboard joint','upper-wishbone','PIVOT'),
  i('upright-lower','front-upright','Lower wishbone outboard joint','lower-wishbone','PIVOT'),
  i('upright-wheel','front-upright','Wheel bearing axis','wheel-tyre','COAXIAL'),
  i('upright-brake','front-upright','Brake rotor axis','brake-disc','COAXIAL'),
  i('upper-in-a','upper-wishbone','Inboard pivot A','chassis-node','PIVOT'),
  i('upper-in-b','upper-wishbone','Inboard pivot B','chassis-node','PIVOT'),
  i('upper-out','upper-wishbone','Outboard ball joint','front-upright','PIVOT'),
  i('lower-in-a','lower-wishbone','Inboard pivot A','chassis-node','PIVOT'),
  i('lower-in-b','lower-wishbone','Inboard pivot B','chassis-node','PIVOT'),
  i('lower-out','lower-wishbone','Outboard ball joint','front-upright','PIVOT'),
  i('pushrod-out','push-rod','Outboard pickup','front-upright','PIVOT'),
  i('pushrod-in','push-rod','Inboard rocker pickup','chassis-node','CONCEPTUAL'),
  i('disc-hub','brake-disc','Rotor mounting interface','front-upright','COAXIAL'),
  i('wheel-bearing','wheel-tyre','Bearing axis','front-upright','COAXIAL'),
]

export const dependencies: Record<string, string[]> = {
  'front-upright': ['upper-wishbone','lower-wishbone','wheel-tyre','brake-disc'],
  'upper-wishbone': ['chassis-node','front-upright'],
  'lower-wishbone': ['chassis-node','front-upright'],
  'push-rod': ['front-upright','chassis-node'],
  'brake-disc': ['front-upright','wheel-tyre'],
  'wheel-tyre': ['front-upright','brake-disc'],
  'chassis-node': ['upper-wishbone','lower-wishbone','push-rod'],
}

export function validateAssemblyModel(): string[] {
  const ids = new Set(parts.map(part => part.id))
  const errors: string[] = []
  for (const edge of interfaces) {
    if (!ids.has(edge.ownerId)) errors.push('Missing interface owner: ' + edge.ownerId)
    if (!ids.has(edge.targetId)) errors.push('Missing interface target: ' + edge.targetId)
  }
  for (const [owner, targets] of Object.entries(dependencies)) {
    if (!ids.has(owner)) errors.push('Missing dependency owner: ' + owner)
    for (const target of targets) if (!ids.has(target)) errors.push('Missing dependency target: ' + target)
  }
  return errors
}
