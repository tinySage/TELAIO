import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import type { Part } from '../model/components'

function createLoftGeometry(sections: NonNullable<Part['sections']>): THREE.BufferGeometry {
  const sides = 24
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

type Props = { parts: Part[]; selectedId: string; hoveredId: string | null; hiddenIds: string[]; isolatedId: string | null; explode: number; onSelect: (id: string) => void; onHover: (id: string | null) => void }

function PartMesh({ part, active, hovered, onSelect, onHover, explode }: { part: Part; active: boolean; hovered: boolean; onSelect: () => void; onHover: (value: boolean) => void; explode: number }) {
  const offset = new THREE.Vector3(...part.explode).multiplyScalar(explode)
  const position = new THREE.Vector3(...part.position).add(offset)
  const color = active ? '#e13b32' : hovered ? '#e6a09b' : part.id.includes('wheel') ? '#17191b' : part.system === 'Aerodynamics' ? '#7c898f' : '#9aa5aa'
  const loftGeometry = useMemo(() => part.shape === 'loft' && part.sections ? createLoftGeometry(part.sections) : null, [part.shape, part.sections])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: part.shape === 'wheel' ? 0.08 : 0.58, roughness: part.shape === 'wheel' ? 0.88 : 0.38, emissive: active || hovered ? '#5d0907' : '#000000', emissiveIntensity: active ? 0.75 : hovered ? 0.28 : 0 }), [color, active, hovered, part.shape])
  const events = { onPointerOver: (event: { stopPropagation: () => void }) => { event.stopPropagation(); onHover(true) }, onPointerOut: (event: { stopPropagation: () => void }) => { event.stopPropagation(); onHover(false) } }
  if (part.shape === 'loft' && loftGeometry) return <mesh {...events} geometry={loftGeometry} position={position.toArray()} material={material} castShadow receiveShadow onClick={(event) => { event.stopPropagation(); onSelect() }} />
  if (part.shape === 'rod') return <group>{(part.segments ?? []).map(([from, to], index) => {
    const start = new THREE.Vector3(...from).add(offset), end = new THREE.Vector3(...to).add(offset)
    const direction = new THREE.Vector3().subVectors(end, start)
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    return <mesh {...events} key={index} position={midpoint.toArray()} quaternion={quaternion} material={material} onClick={(event) => { event.stopPropagation(); onSelect() }} castShadow><cylinderGeometry args={[active || hovered ? 0.04 : 0.026, active || hovered ? 0.04 : 0.026, direction.length(), 12]} /></mesh>
  })}</group>
  return <group position={position.toArray()} onClick={(event) => { event.stopPropagation(); onSelect() }} {...events}>
    {part.shape === 'wheel' && <mesh material={material} castShadow receiveShadow rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[part.size?.[0] ?? 0.48, part.size?.[1] ?? 0.16, 24, 56]} /></mesh>}
    {part.shape === 'disc' && <mesh material={material} castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[part.size?.[0] ?? 0.3, part.size?.[0] ?? 0.3, part.size?.[1] ?? 0.07, 48]} /></mesh>}
    {part.shape === 'hub' && <mesh material={material} castShadow><cylinderGeometry args={[part.size?.[0] ?? 0.2, part.size?.[0] ?? 0.2, part.size?.[1] ?? 0.32, 16]} /></mesh>}
    {part.shape === 'box' && <mesh material={material} castShadow receiveShadow><boxGeometry args={part.size ?? [0.65, 0.3, 0.42]} /></mesh>}
  </group>
}

function Scene({ parts, selectedId, hoveredId, hiddenIds, isolatedId, explode, onSelect, onHover }: Props) {
  return <>
    <color attach="background" args={['#111518']} /><fog attach="fog" args={['#111518', 7, 16]} />
    <ambientLight intensity={0.82} /><directionalLight position={[3, 6, 5]} intensity={2.3} castShadow /><pointLight position={[-3, 1, -2]} intensity={28} color="#b7c8d1" />
    <group rotation={[0.12, -0.42, 0]}>{parts.map((part) => {
      const visible = !hiddenIds.includes(part.id) && (!isolatedId || isolatedId === part.id)
      return visible ? <PartMesh key={part.id} part={part} active={selectedId === part.id} hovered={hoveredId === part.id} onSelect={() => onSelect(part.id)} onHover={(value) => onHover(value ? part.id : null)} explode={explode} /> : null
    })}</group>
    <gridHelper args={[10, 20, '#30383d', '#20272b']} position={[0, -0.72, 0]} />
    <ContactShadows position={[0, -0.72, 0]} opacity={0.3} scale={8} blur={2.5} far={3} />
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2.5} maxDistance={12} />
    <GizmoHelper alignment="bottom-left" margin={[68, 68]}><GizmoViewport axisColors={['#e35a51', '#7fbd93', '#78a9d1']} labelColor="white" /></GizmoHelper>
  </>
}
export default function AssemblyScene(props: Props) { return <Canvas shadows camera={{ position: [4.4, 2.7, 5.6], fov: 42 }} dpr={[1, 1.7]}><Scene {...props} /></Canvas> }
