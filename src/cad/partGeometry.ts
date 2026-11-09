/**
 * Procedural display geometry of study parts, in the vehicle study frame. The 3D workbench and the
 * drafting views share these builders so a drawing matches what the viewport shows. Imported glTF
 * assets are not used here: drawings show each part's procedural envelope.
 */
import * as THREE from 'three'
import type { Part, Vec3 } from '../model/components'

export function createLoftGeometry(sections: NonNullable<Part['sections']>, sides = 24): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  sections.forEach((section) => {
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2
      positions.push(section.x, section.y + Math.sin(angle) * section.height * 0.5, Math.cos(angle) * section.width * 0.5)
    }
  })
  for (let ring = 0; ring < sections.length - 1; ring++) {
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side, b = ring * sides + (side + 1) % sides
      const c = (ring + 1) * sides + (side + 1) % sides, d = (ring + 1) * sides + side
      indices.push(a, b, d, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Meshes (study frame) and centre lines of a part, matching the workbench's procedural rendering at zero explode. */
export function partDrawingGeometry(part: Part): { meshes: THREE.BufferGeometry[]; lines: [Vec3, Vec3][] } {
  if (part.shape === 'rod') return { meshes: [], lines: part.segments ?? [] }
  const placement = new THREE.Matrix4().compose(new THREE.Vector3(...part.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1))
  let g: THREE.BufferGeometry
  if (part.shape === 'loft' && part.sections) { g = createLoftGeometry(part.sections); g.translate(...part.position); return { meshes: [g], lines: [] } }
  if (part.shape === 'wheel') g = new THREE.TorusGeometry(part.size?.[0] ?? 0.48, part.size?.[1] ?? 0.16, 16, 40)
  else if (part.shape === 'disc') { g = new THREE.CylinderGeometry(part.size?.[0] ?? 0.3, part.size?.[0] ?? 0.3, part.size?.[1] ?? 0.07, 32); g.rotateZ(Math.PI / 2) }
  else if (part.shape === 'hub') g = new THREE.CylinderGeometry(part.size?.[0] ?? 0.2, part.size?.[0] ?? 0.2, part.size?.[1] ?? 0.32, 16)
  else if (part.shape === 'box') { const s = part.size ?? [0.65, 0.3, 0.42]; g = new THREE.BoxGeometry(s[0], s[1], s[2]) }
  else return { meshes: [], lines: [] }
  g.applyMatrix4(placement)
  return { meshes: [g], lines: [] }
}
