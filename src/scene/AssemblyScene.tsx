import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import type { Part } from '../model/components'

type Props = { parts: Part[]; selectedId: string; hiddenIds: string[]; isolatedId: string | null; explode: number; onSelect: (id: string) => void }

function PartMesh({ part, active, onSelect, explode }: { part: Part; active: boolean; onSelect: () => void; explode: number }) {
  const offset = new THREE.Vector3(...part.explode).multiplyScalar(explode)
  const position = new THREE.Vector3(...part.position).add(offset)
  const color = active ? '#e13b32' : part.id.includes('wheel') ? '#17191b' : part.system === 'Aerodynamics' ? '#7c898f' : '#9aa5aa'
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: part.shape === 'wheel' ? 0.08 : 0.58, roughness: part.shape === 'wheel' ? 0.88 : 0.38, emissive: active ? '#5d0907' : '#000000', emissiveIntensity: active ? 0.75 : 0 }), [color, active, part.shape])
  if (part.shape === 'rod') {
    return <group>{(part.segments ?? []).map(([from, to], index) => {
      const start = new THREE.Vector3(...from).add(offset)
      const end = new THREE.Vector3(...to).add(offset)
      const direction = new THREE.Vector3().subVectors(end, start)
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
      return <mesh key={index} position={midpoint.toArray()} quaternion={quaternion} material={material} onClick={(event) => { event.stopPropagation(); onSelect() }} castShadow><cylinderGeometry args={[active ? 0.035 : 0.026, active ? 0.035 : 0.026, direction.length(), 12]} /></mesh>
    })}</group>
  }
  return <group position={position.toArray()} onClick={(event) => { event.stopPropagation(); onSelect() }}>
    {part.shape === 'wheel' && <mesh material={material} castShadow receiveShadow rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[part.size?.[0] ?? 0.48, part.size?.[1] ?? 0.16, 24, 56]} /></mesh>}
    {part.shape === 'disc' && <mesh material={material} castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[part.size?.[0] ?? 0.3, part.size?.[0] ?? 0.3, part.size?.[1] ?? 0.07, 48]} /></mesh>}
    {part.shape === 'hub' && <mesh material={material} castShadow><cylinderGeometry args={[part.size?.[0] ?? 0.2, part.size?.[0] ?? 0.2, part.size?.[1] ?? 0.32, 16]} /></mesh>}
    {part.shape === 'box' && <mesh material={material} castShadow receiveShadow><boxGeometry args={part.size ?? [0.65, 0.3, 0.42]} /></mesh>}
  </group>
}

function Scene({ parts, selectedId, hiddenIds, isolatedId, explode, onSelect }: Props) {
  return <>
    <color attach="background" args={['#111518']} /><fog attach="fog" args={['#111518', 7, 16]} />
    <ambientLight intensity={0.82} /><directionalLight position={[3, 6, 5]} intensity={2.3} castShadow /><pointLight position={[-3, 1, -2]} intensity={28} color="#b7c8d1" />
    <group rotation={[0.12, -0.42, 0]}>{parts.map((part) => {
      const visible = !hiddenIds.includes(part.id) && (!isolatedId || isolatedId === part.id)
      return visible ? <PartMesh key={part.id} part={part} active={selectedId === part.id} onSelect={() => onSelect(part.id)} explode={explode} /> : null
    })}</group>
    <gridHelper args={[10, 20, '#30383d', '#20272b']} position={[0, -0.72, 0]} />
    <ContactShadows position={[0, -0.72, 0]} opacity={0.3} scale={8} blur={2.5} far={3} />
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2.5} maxDistance={12} />
    <GizmoHelper alignment="bottom-left" margin={[68, 68]}><GizmoViewport axisColors={['#e35a51', '#7fbd93', '#78a9d1']} labelColor="white" /></GizmoHelper>
  </>
}
export default function AssemblyScene(props: Props) { return <Canvas shadows camera={{ position: [4.4, 2.7, 5.6], fov: 42 }} dpr={[1, 1.7]}><Scene {...props} /></Canvas> }
