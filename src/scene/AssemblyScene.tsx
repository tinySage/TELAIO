import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import type { Part } from '../model/components'

type Props = {
  parts: Part[]
  selectedId: string
  hiddenIds: string[]
  isolatedId: string | null
  explode: number
  onSelect: (id: string) => void
}

function LinkMesh({ part, active, onSelect, explode }: { part: Part; active: boolean; onSelect: () => void; explode: number }) {
  const color = active ? '#f04438' : '#aeb7bd'
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.78, roughness: 0.28, emissive: active ? '#5d0907' : '#000000', emissiveIntensity: active ? 0.8 : 0 }), [color, active])
  const offset = new THREE.Vector3(...part.explode).multiplyScalar(explode)
  const start = new THREE.Vector3(-0.62, part.position[1] * 0.7, part.position[2]).add(offset)
  const end = new THREE.Vector3(0.92, part.position[1] * 0.5, part.position[2] + (part.id === 'push-rod' ? 0.16 : 0)).add(offset)
  const direction = new THREE.Vector3().subVectors(end, start)
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
  return <mesh position={midpoint.toArray()} quaternion={quaternion} material={material} onClick={(e) => { e.stopPropagation(); onSelect() }} castShadow>
    <cylinderGeometry args={[active ? 0.035 : 0.026, active ? 0.035 : 0.026, direction.length(), 12]} />
  </mesh>
}

function PartMesh({ part, active, onSelect, explode }: { part: Part; active: boolean; onSelect: () => void; explode: number }) {
  const offset = new THREE.Vector3(...part.explode).multiplyScalar(explode)
  const position = new THREE.Vector3(...part.position).add(offset)
  const base = active ? '#e33b32' : part.id === 'wheel-tyre' ? '#17191b' : '#68747b'
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: base, metalness: part.shape === 'wheel' ? 0.05 : 0.72, roughness: part.shape === 'wheel' ? 0.86 : 0.34, emissive: active ? '#5d0907' : '#000000', emissiveIntensity: active ? 0.65 : 0 }), [base, active, part.shape])
  if (part.shape === 'rod') return <LinkMesh part={part} active={active} onSelect={onSelect} explode={explode} />
  return <group position={position.toArray()} onClick={(e) => { e.stopPropagation(); onSelect() }}>
    {part.shape === 'wheel' && <mesh material={material} castShadow receiveShadow rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.48, 0.16, 20, 48]} /></mesh>}
    {part.shape === 'disc' && <mesh material={material} castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.07, 48]} /></mesh>}
    {part.shape === 'hub' && <mesh material={material} castShadow><cylinderGeometry args={[0.2, 0.2, 0.34, 12]} /></mesh>}
    {part.shape === 'box' && <mesh material={material} castShadow><boxGeometry args={[0.65, 0.3, 0.42]} /></mesh>}
  </group>
}

function Scene({ parts, selectedId, hiddenIds, isolatedId, explode, onSelect }: Props) {
  return <>
    <color attach="background" args={['#111518']} />
    <fog attach="fog" args={['#111518', 7, 16]} />
    <ambientLight intensity={0.8} />
    <directionalLight position={[3, 5, 4]} intensity={2.2} castShadow />
    <pointLight position={[-3, 1, -2]} intensity={35} color="#a9c3d2" />
    <group rotation={[0.15, -0.32, 0]}>
      {parts.map((part) => {
        const visible = !hiddenIds.includes(part.id) && (!isolatedId || isolatedId === part.id)
        if (!visible) return null
        return <PartMesh key={part.id} part={part} active={selectedId === part.id} onSelect={() => onSelect(part.id)} explode={explode} />
      })}
    </group>
    <gridHelper args={[10, 20, '#30383d', '#20272b']} position={[0, -0.72, 0]} />
    <ContactShadows position={[0, -0.7, 0]} opacity={0.28} scale={7} blur={2.5} far={3} />
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2.5} maxDistance={10} />
    <GizmoHelper alignment="bottom-left" margin={[68, 68]}><GizmoViewport axisColors={['#e35a51', '#7fbd93', '#78a9d1']} labelColor="white" /></GizmoHelper>
  </>
}

export default function AssemblyScene(props: Props) {
  return <Canvas shadows camera={{ position: [3.4, 2.1, 4.6], fov: 42 }} dpr={[1, 1.7]}>
    <Scene {...props} />
  </Canvas>
}
