/** 3D view of the Design workspace: ghosted study car, user solids, and draggable suspension hardpoints. */
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Line, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Part, Vec3 } from '../model/components'
import { mirror, type CornerHardpoints } from '../model/hardpoints'
import { VEHICLE_FRAME_ROTATION } from '../model/cad'
import { partDrawingGeometry } from '../cad/partGeometry'
import { featureGeometry, PLANE_BASIS, planePoint, type ResolvedFeature } from '../cad/solids'
import { POINTS } from './SuspensionLab'

const noRaycast = () => null

function Ghost({ parts }: { parts: Part[] }) {
  const { meshes, lines } = useMemo(() => {
    const all = parts.map(partDrawingGeometry)
    return { meshes: all.flatMap((g) => g.meshes), lines: all.flatMap((g) => g.lines) }
  }, [parts])
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  return <group>
    {meshes.map((g, i) => <mesh key={i} geometry={g} raycast={noRaycast}><meshStandardMaterial color="#8a959b" transparent opacity={0.13} depthWrite={false} /></mesh>)}
    {lines.length > 0 && <Line points={lines.flat()} segments color="#5d686e" lineWidth={1} raycast={noRaycast} />}
  </group>
}

function Solid({ feature, selected, onSelect }: { feature: ResolvedFeature; selected: boolean; onSelect: () => void }) {
  const geometry = useMemo(() => featureGeometry(feature), [feature])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return <mesh geometry={geometry} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect() }}>
    <meshStandardMaterial color={selected ? '#e13b32' : '#c9a86a'} metalness={0.35} roughness={0.45} side={THREE.DoubleSide} emissive={selected ? '#5d0907' : '#000'} emissiveIntensity={selected ? 0.6 : 0} />
  </mesh>
}

/** Translucent sketch plane with its u (red) and v (green) axes, for the selected feature. */
function SketchPlaneMarker({ feature }: { feature: ResolvedFeature }) {
  const [a, b, n] = PLANE_BASIS[feature.plane]
  const quaternion = useMemo(() => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...n))), [a, b, n])
  const origin = planePoint(feature.plane, 0, 0, feature.offset)
  return <group>
    <mesh position={origin} quaternion={quaternion} raycast={noRaycast}><planeGeometry args={[4, 4]} /><meshBasicMaterial color="#78a9d1" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <Line points={[origin, planePoint(feature.plane, 0.5, 0, feature.offset)]} color="#e35a51" lineWidth={2} raycast={noRaycast} />
    <Line points={[origin, planePoint(feature.plane, 0, 0.5, feature.offset)]} color="#7fbd93" lineWidth={2} raycast={noRaycast} />
    {feature.polygon.length > 1 && <Line points={[...feature.polygon, feature.polygon[0]].map(([u, v]) => planePoint(feature.plane, u, v, feature.offset))} color="#78a9d1" lineWidth={1.5} raycast={noRaycast} />}
  </group>
}

type HardpointProps = { corners: { front: CornerHardpoints; rear: CornerHardpoints }; activeCorner: 'front' | 'rear'; selectedPoint: number | null; onSelectPoint: (index: number) => void; onMovePoint: (index: number, v: Vec3) => void }

function Linkage({ h, active, selectedPoint, onSelectPoint }: { h: CornerHardpoints; active: boolean; selectedPoint: number | null; onSelectPoint: (i: number) => void }) {
  const segs: [Vec3, Vec3][] = [...h.links.map((l) => [l.inboard, l.outboard] as [Vec3, Vec3]), [h.actuation.inboard, h.actuation.outboard]]
  const colour = active ? '#f2c14e' : '#7a6a3e'
  return <group>
    <Line points={segs.flat()} segments color={colour} lineWidth={active ? 2.2 : 1.4} raycast={noRaycast} />
    <Line points={segs.flat().map(mirror)} segments color={colour} lineWidth={1} transparent opacity={0.45} raycast={noRaycast} />
    {POINTS.map((p, i) => {
      const at = p.get(h), sel = active && selectedPoint === i
      return <mesh key={p.key} position={at} onClick={active ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelectPoint(i) } : undefined} raycast={active ? undefined : noRaycast}>
        <sphereGeometry args={[sel ? 0.034 : 0.024, 14, 10]} />
        <meshBasicMaterial color={sel ? '#e13b32' : colour} depthTest={false} transparent />
      </mesh>
    })}
  </group>
}

/** Drag handle for the selected hardpoint: arrows move it along the study-frame axes, updating live. */
function Handle({ position, onMove }: { position: Vec3; onMove: (v: Vec3) => void }) {
  const marker = useRef<THREE.Mesh>(null!)
  const read = () => { const g = marker.current?.parent; if (g) onMove(g.position.toArray().map((v) => Math.round(v * 1e4) / 1e4) as Vec3) }
  return <TransformControls position={position} mode="translate" space="local" size={0.6} onObjectChange={read}>
    <mesh ref={marker} raycast={noRaycast}><sphereGeometry args={[0.001]} /><meshBasicMaterial visible={false} /></mesh>
  </TransformControls>
}

export default function DesignScene({ parts, features, selectedFeature, onSelectFeature, showGhost, hardpoints }: {
  parts: Part[]; features: ResolvedFeature[]; selectedFeature: string | null; onSelectFeature: (id: string | null) => void; showGhost: boolean; hardpoints: HardpointProps | null
}) {
  const selected = features.find((f) => f.id === selectedFeature)
  const h = hardpoints?.corners[hardpoints.activeCorner]
  return <Canvas camera={{ position: [4.4, 2.7, 5.6], fov: 42 }} dpr={[1, 1.7]} onPointerMissed={() => onSelectFeature(null)}>
    <color attach="background" args={['#111518']} />
    <ambientLight intensity={0.9} /><directionalLight position={[3, 6, 5]} intensity={2.2} /><pointLight position={[-3, 1, -2]} intensity={24} color="#b7c8d1" />
    <group rotation={VEHICLE_FRAME_ROTATION}>
      {showGhost && <Ghost parts={parts} />}
      {features.filter((f) => f.visible).map((f) => <Solid key={f.id} feature={f} selected={f.id === selectedFeature} onSelect={() => onSelectFeature(f.id)} />)}
      {selected && <SketchPlaneMarker feature={selected} />}
      {hardpoints && (['front', 'rear'] as const).map((c) => <Linkage key={c} h={hardpoints.corners[c]} active={c === hardpoints.activeCorner} selectedPoint={hardpoints.selectedPoint} onSelectPoint={hardpoints.onSelectPoint} />)}
      {hardpoints && h && hardpoints.selectedPoint !== null && <Handle position={POINTS[hardpoints.selectedPoint].get(h)} onMove={(v) => hardpoints.onMovePoint(hardpoints.selectedPoint!, v)} />}
      <axesHelper args={[0.5]} raycast={noRaycast} />
    </group>
    <gridHelper args={[10, 20, '#30383d', '#20272b']} position={[0, -0.72, 0]} />
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.6} maxDistance={12} />
    <GizmoHelper alignment="bottom-left" margin={[68, 68]}><GizmoViewport axisColors={['#e35a51', '#7fbd93', '#78a9d1']} labelColor="white" /></GizmoHelper>
  </Canvas>
}
