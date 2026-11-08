import { useEffect, useMemo } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, ContactShadows, GizmoHelper, GizmoViewport, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Part, Vec3 } from '../model/components'
import type { LoadedComponentAsset } from './loadGeometryAsset'
import { keptBySection, sectionPlane, VEHICLE_FRAME_ROTATION, type MeasureMode, type SectionSettings } from '../model/cad'

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

/** World matrix of the vehicle study frame, and its inverse, for converting picks and section planes. */
const vehicleMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...VEHICLE_FRAME_ROTATION))
const vehicleInverse = vehicleMatrix.clone().invert()
const toVehicleFrame = (world: THREE.Vector3): Vec3 => world.clone().applyMatrix4(vehicleInverse).toArray() as Vec3

/** Representative point of a part in the vehicle frame, including its current explode offset. */
export function partAnchor(part: Part, explode: number): Vec3 {
  const offset = new THREE.Vector3(...part.explode).multiplyScalar(explode)
  if (part.shape === 'rod' && part.segments?.length) {
    const sum = new THREE.Vector3()
    part.segments.forEach(([from, to]) => sum.add(new THREE.Vector3(...from)).add(new THREE.Vector3(...to)))
    return sum.multiplyScalar(1 / (part.segments.length * 2)).add(offset).toArray() as Vec3
  }
  return new THREE.Vector3(...part.position).add(offset).toArray() as Vec3
}

export type FocusRequest = { id: string; nonce: number }

type Props = {
  parts: Part[]; assets: Record<string, LoadedComponentAsset>; selectedId: string; hoveredId: string | null; hiddenIds: string[]; isolatedId: string | null; explode: number
  section: SectionSettings | null; measureMode: MeasureMode; measurePoints: Vec3[]; showFrames: boolean; focusRequest: FocusRequest | null
  onSelect: (id: string) => void; onHover: (id: string | null) => void; onMeasurePoint: (point: Vec3) => void
}

type PickHandlers = { onPick: (event: ThreeEvent<MouseEvent>) => void; onPointerOver: (event: ThreeEvent<PointerEvent>) => void; onPointerOut: (event: ThreeEvent<PointerEvent>) => void }

function PartMesh({ part, asset, active, hovered, explode, clippingPlanes, handlers }: { part: Part; asset?: LoadedComponentAsset; active: boolean; hovered: boolean; explode: number; clippingPlanes: THREE.Plane[]; handlers: PickHandlers }) {
  const offset = new THREE.Vector3(...part.explode).multiplyScalar(explode)
  const position = new THREE.Vector3(...part.position).add(offset)
  const color = active ? '#e13b32' : hovered ? '#e6a09b' : part.id.includes('wheel') ? '#17191b' : part.system === 'Aerodynamics' ? '#7c898f' : '#9aa5aa'
  const loftGeometry = useMemo(() => part.shape === 'loft' && part.sections ? createLoftGeometry(part.sections) : null, [part.shape, part.sections])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: part.shape === 'wheel' ? 0.08 : 0.58, roughness: part.shape === 'wheel' ? 0.88 : 0.38, emissive: active || hovered ? '#5d0907' : '#000000', emissiveIntensity: active ? 0.75 : hovered ? 0.28 : 0, clippingPlanes, clipShadows: true, side: clippingPlanes.length ? THREE.DoubleSide : THREE.FrontSide }), [color, active, hovered, part.shape, clippingPlanes])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    if (!asset) return
    asset.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      const materials = Array.isArray(node.material) ? node.material : [node.material]
      materials.forEach((material) => {
        const candidate = material as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number; userData: Record<string, unknown> }
        if (candidate.color && !candidate.userData.telaioBaseColor) candidate.userData.telaioBaseColor = candidate.color.clone()
        if (candidate.emissive && !candidate.userData.telaioBaseEmissive) candidate.userData.telaioBaseEmissive = candidate.emissive.clone()
        if (candidate.color) {
          const base = candidate.userData.telaioBaseColor as THREE.Color
          candidate.color.copy(base).lerp(new THREE.Color(active ? '#e13b32' : '#e6a09b'), active ? 0.48 : hovered ? 0.24 : 0)
        }
        if (candidate.emissive) {
          candidate.emissive.copy(candidate.userData.telaioBaseEmissive as THREE.Color).lerp(new THREE.Color('#5d0907'), active ? 0.65 : hovered ? 0.28 : 0)
          candidate.emissiveIntensity = active ? 0.7 : hovered ? 0.3 : 0
        }
        candidate.clippingPlanes = clippingPlanes
        candidate.clipShadows = true
        candidate.side = clippingPlanes.length ? THREE.DoubleSide : THREE.FrontSide
        candidate.needsUpdate = true
      })
    })
  }, [asset, active, hovered, clippingPlanes])
  const events = { onClick: handlers.onPick, onPointerOver: handlers.onPointerOver, onPointerOut: handlers.onPointerOut }
  if (asset) return <group position={position.toArray()} rotation={part.rotation} {...events}><primitive object={asset.group} /></group>
  if (part.shape === 'loft' && loftGeometry) return <mesh {...events} geometry={loftGeometry} position={position.toArray()} material={material} castShadow receiveShadow />
  if (part.shape === 'rod') return <group>{(part.segments ?? []).map(([from, to], index) => {
    const start = new THREE.Vector3(...from).add(offset), end = new THREE.Vector3(...to).add(offset)
    const direction = new THREE.Vector3().subVectors(end, start)
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    return <mesh {...events} key={index} position={midpoint.toArray()} quaternion={quaternion} material={material} castShadow><cylinderGeometry args={[active || hovered ? 0.04 : 0.026, active || hovered ? 0.04 : 0.026, direction.length(), 12]} /></mesh>
  })}</group>
  return <group position={position.toArray()} rotation={part.rotation} {...events}>
    {part.shape === 'wheel' && <mesh material={material} castShadow receiveShadow><torusGeometry args={[part.size?.[0] ?? 0.48, part.size?.[1] ?? 0.16, 24, 56]} /></mesh>}
    {part.shape === 'disc' && <mesh material={material} castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[part.size?.[0] ?? 0.3, part.size?.[0] ?? 0.3, part.size?.[1] ?? 0.07, 48]} /></mesh>}
    {part.shape === 'hub' && <mesh material={material} castShadow><cylinderGeometry args={[part.size?.[0] ?? 0.2, part.size?.[0] ?? 0.2, part.size?.[1] ?? 0.32, 16]} /></mesh>}
    {part.shape === 'box' && <mesh material={material} castShadow receiveShadow><boxGeometry args={part.size ?? [0.65, 0.3, 0.42]} /></mesh>}
  </group>
}

const noRaycast = () => null

/** Translucent marker showing where the section plane cuts, in the vehicle frame. */
function SectionMarker({ section }: { section: SectionSettings }) {
  const rotation: Vec3 = section.axis === 'x' ? [0, Math.PI / 2, 0] : section.axis === 'y' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]
  const position: Vec3 = [section.axis === 'x' ? section.offset : -0.1, section.axis === 'y' ? section.offset : 0.1, section.axis === 'z' ? section.offset : 0]
  const size: [number, number] = section.axis === 'x' ? [2.6, 1.6] : section.axis === 'y' ? [5, 2.6] : [5, 1.6]
  return <group position={position} rotation={rotation}>
    <mesh raycast={noRaycast}><planeGeometry args={size} /><meshBasicMaterial color="#d9342b" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <lineSegments raycast={noRaycast}><edgesGeometry args={[new THREE.PlaneGeometry(...size)]} /><lineBasicMaterial color="#d9342b" transparent opacity={0.6} /></lineSegments>
  </group>
}

function MeasureOverlay({ points }: { points: Vec3[] }) {
  return <group>
    {points.map((point, index) => <mesh key={index} position={point} raycast={noRaycast} renderOrder={10}><sphereGeometry args={[0.022, 16, 12]} /><meshBasicMaterial color="#f2c14e" depthTest={false} /></mesh>)}
    {points.length > 1 && <Line points={points} color="#f2c14e" lineWidth={2} depthTest={false} renderOrder={10} raycast={noRaycast} />}
  </group>
}

function FocusController({ request, parts, explode }: { request: FocusRequest | null; parts: Part[]; explode: number }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => {
    if (!request || !controls) return
    const part = parts.find((item) => item.id === request.id)
    if (!part) return
    const target = new THREE.Vector3(...partAnchor(part, explode)).applyMatrix4(vehicleMatrix)
    const direction = camera.position.clone().sub(controls.target).normalize()
    controls.target.copy(target)
    camera.position.copy(target).add(direction.multiplyScalar(1.6))
    controls.update()
    // Only a new request moves the camera; explode changes alone do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, controls, camera])
  return null
}

function Scene({ parts, assets, selectedId, hoveredId, hiddenIds, isolatedId, explode, section, measureMode, measurePoints, showFrames, focusRequest, onSelect, onHover, onMeasurePoint }: Props) {
  const clippingPlanes = useMemo(() => {
    if (!section) return [] as THREE.Plane[]
    const { normal, constant } = sectionPlane(section)
    return [new THREE.Plane(new THREE.Vector3(...normal), constant).applyMatrix4(vehicleMatrix)]
  }, [section])
  const selected = parts.find((part) => part.id === selectedId)
  const handlersFor = (id: string): PickHandlers => {
    // Clipped geometry still intersects rays; a pick on the cut-away side passes through to what is visible behind it.
    const visible = (event: ThreeEvent<PointerEvent | MouseEvent>) => !section || keptBySection(toVehicleFrame(event.point), section)
    return {
      onPick: (event) => {
        if (!visible(event)) return
        event.stopPropagation()
        if (measureMode !== 'off') onMeasurePoint(toVehicleFrame(event.point))
        else onSelect(id)
      },
      onPointerOver: (event) => { if (!visible(event)) return; event.stopPropagation(); onHover(id) },
      onPointerOut: (event) => { event.stopPropagation(); onHover(null) },
    }
  }
  return <>
    <color attach="background" args={['#111518']} /><fog attach="fog" args={['#111518', 7, 16]} />
    <ambientLight intensity={0.82} /><directionalLight position={[3, 6, 5]} intensity={2.3} castShadow /><pointLight position={[-3, 1, -2]} intensity={28} color="#b7c8d1" />
    <group rotation={VEHICLE_FRAME_ROTATION}>
      {parts.map((part) => {
        const visible = !hiddenIds.includes(part.id) && (!isolatedId || isolatedId === part.id)
        return visible ? <PartMesh key={part.id} part={part} asset={assets[part.id]} active={selectedId === part.id} hovered={hoveredId === part.id} explode={explode} clippingPlanes={clippingPlanes} handlers={handlersFor(part.id)} /> : null
      })}
      {section && <SectionMarker section={section} />}
      <MeasureOverlay points={measurePoints} />
      {showFrames && <axesHelper args={[0.7]} raycast={noRaycast} />}
      {showFrames && selected && <group position={partAnchor(selected, explode)} rotation={selected.rotation ?? [0, 0, 0]}><axesHelper args={[0.3]} raycast={noRaycast} /></group>}
    </group>
    <gridHelper args={[10, 20, '#30383d', '#20272b']} position={[0, -0.72, 0]} />
    <ContactShadows position={[0, -0.72, 0]} opacity={0.3} scale={8} blur={2.5} far={3} />
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.6} maxDistance={12} />
    <FocusController request={focusRequest} parts={parts} explode={explode} />
    <GizmoHelper alignment="bottom-left" margin={[68, 68]}><GizmoViewport axisColors={['#e35a51', '#7fbd93', '#78a9d1']} labelColor="white" /></GizmoHelper>
  </>
}
export default function AssemblyScene(props: Props) { return <Canvas shadows camera={{ position: [4.4, 2.7, 5.6], fov: 42 }} dpr={[1, 1.7]} gl={{ localClippingEnabled: true }}><Scene {...props} /></Canvas> }
