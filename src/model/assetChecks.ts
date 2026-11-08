/**
 * Repeatable geometry checks for glTF 2.0 assets, independent of three.js and the browser.
 * Used by `npm run assets:check` (scripts/check-assets.ts) and the test suite.
 * Supports .gltf with embedded (data:) or external buffers. Binary .glb is reported as unsupported.
 */

export type GltfJson = {
  asset?: { version?: string; generator?: string }
  scene?: number
  scenes?: { nodes?: number[] }[]
  nodes?: { name?: string; mesh?: number; children?: number[] }[]
  meshes?: { name?: string; primitives?: { attributes?: Record<string, number>; indices?: number; mode?: number; material?: number }[] }[]
  accessors?: { bufferView?: number; byteOffset?: number; componentType?: number; count?: number; type?: string; min?: number[]; max?: number[] }[]
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number; byteStride?: number }[]
  buffers?: { uri?: string; byteLength?: number }[]
  materials?: unknown[]
}

export type AssetStats = { meshes: number; primitives: number; triangles: number; vertices: number; materials: number; bounds: { min: [number, number, number]; max: [number, number, number] } | null; nodeNames: string[] }
export type AssetCheckResult = { errors: string[]; warnings: string[]; stats: AssetStats }

const COMPONENT_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
const TRIANGLES = 4

export function decodeDataUri(uri: string): Uint8Array | null {
  const match = /^data:[^;,]*;base64,(.*)$/s.exec(uri)
  if (!match) return null
  const binary = atob(match[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Resolves every buffer to bytes: data URIs are decoded; other URIs go to `loadExternal` (relative to the asset). */
export async function resolveBuffers(gltf: GltfJson, loadExternal: (uri: string) => Promise<Uint8Array | null>): Promise<(Uint8Array | null)[]> {
  return Promise.all((gltf.buffers ?? []).map(async (buffer) => {
    if (!buffer.uri) return null
    return decodeDataUri(buffer.uri) ?? loadExternal(buffer.uri)
  }))
}

function readComponent(view: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5120: return view.getInt8(offset)
    case 5121: return view.getUint8(offset)
    case 5122: return view.getInt16(offset, true)
    case 5123: return view.getUint16(offset, true)
    case 5125: return view.getUint32(offset, true)
    default: return view.getFloat32(offset, true)
  }
}

/** Validates structure, buffer ranges, accessor bounds and indices; reports geometry statistics. */
export function checkGltf(gltf: GltfJson, buffers: (Uint8Array | null)[], requiredNodeNames: string[] = []): AssetCheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const nodes = gltf.nodes ?? [], meshes = gltf.meshes ?? [], accessors = gltf.accessors ?? [], views = gltf.bufferViews ?? []
  const stats: AssetStats = { meshes: meshes.length, primitives: 0, triangles: 0, vertices: 0, materials: (gltf.materials ?? []).length, bounds: null, nodeNames: nodes.map((node) => node.name ?? '').filter(Boolean) }

  if (gltf.asset?.version !== '2.0') errors.push('asset.version must be "2.0" (found ' + JSON.stringify(gltf.asset?.version) + ')')
  for (const name of requiredNodeNames) if (!stats.nodeNames.includes(name)) errors.push('Manifest node name not found in asset: ' + name)
  if (meshes.length === 0) errors.push('Asset contains no meshes')

  ;(gltf.buffers ?? []).forEach((buffer, index) => {
    const data = buffers[index]
    if (!data) errors.push(`buffers[${index}]: data could not be resolved` + (buffer.uri ? '' : ' (no uri; GLB binary chunks are not supported by this checker)'))
    else if ((buffer.byteLength ?? 0) > data.byteLength) errors.push(`buffers[${index}]: declares ${buffer.byteLength} bytes but has ${data.byteLength}`)
  })
  views.forEach((view, index) => {
    const data = view.buffer === undefined ? null : buffers[view.buffer]
    const end = (view.byteOffset ?? 0) + (view.byteLength ?? 0)
    if (view.buffer === undefined || !(gltf.buffers ?? [])[view.buffer]) errors.push(`bufferViews[${index}]: missing buffer`)
    else if (data && end > data.byteLength) errors.push(`bufferViews[${index}]: range ends at ${end}, beyond buffer length ${data.byteLength}`)
  })

  /** Returns a reader for an accessor's components, or null after recording why it is unreadable. */
  const reader = (index: number, label: string) => {
    const accessor = accessors[index]
    if (!accessor) { errors.push(`${label}: accessor ${index} does not exist`); return null }
    const componentSize = COMPONENT_SIZE[accessor.componentType ?? -1], components = TYPE_COUNT[accessor.type ?? '']
    if (!componentSize || !components) { errors.push(`${label}: accessor ${index} has invalid componentType/type`); return null }
    const view = accessor.bufferView === undefined ? undefined : views[accessor.bufferView]
    const data = view?.buffer === undefined ? null : buffers[view.buffer]
    if (!view || !data) { errors.push(`${label}: accessor ${index} has no readable bufferView`); return null }
    const elementSize = componentSize * components, stride = view.byteStride ?? elementSize, count = accessor.count ?? 0
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const needed = count === 0 ? 0 : (accessor.byteOffset ?? 0) + stride * (count - 1) + elementSize
    if (needed > (view.byteLength ?? 0)) { errors.push(`${label}: accessor ${index} needs ${needed} bytes but its bufferView has ${view.byteLength}`); return null }
    const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength)
    return { accessor, count, components, at: (element: number, component: number) => readComponent(dataView, start + element * stride + component * componentSize, accessor.componentType!) }
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  meshes.forEach((mesh, meshIndex) => (mesh.primitives ?? []).forEach((primitive, primitiveIndex) => {
    stats.primitives++
    const label = `meshes[${meshIndex}].primitives[${primitiveIndex}]`
    const positionIndex = primitive.attributes?.POSITION
    if (positionIndex === undefined) { errors.push(label + ': no POSITION attribute'); return }
    const positions = reader(positionIndex, label + ' POSITION')
    if (!positions) return
    if (positions.components !== 3) { errors.push(label + ': POSITION must be VEC3'); return }
    const declaredMin = positions.accessor.min, declaredMax = positions.accessor.max
    if (!declaredMin || !declaredMax || declaredMin.length !== 3 || declaredMax.length !== 3) errors.push(label + ': POSITION accessor must declare min and max (glTF requirement)')
    const actualMin = [Infinity, Infinity, Infinity], actualMax = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < positions.count; i++) for (let axis = 0; axis < 3; axis++) {
      const value = positions.at(i, axis)
      if (!Number.isFinite(value)) { errors.push(`${label}: non-finite vertex coordinate at vertex ${i}`); return }
      actualMin[axis] = Math.min(actualMin[axis], value); actualMax[axis] = Math.max(actualMax[axis], value)
    }
    if (declaredMin && declaredMax) for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(declaredMin[axis] - actualMin[axis]) > 1e-4 || Math.abs(declaredMax[axis] - actualMax[axis]) > 1e-4) { errors.push(label + ': declared POSITION min/max do not match the vertex data'); break }
    }
    for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], actualMin[axis]); max[axis] = Math.max(max[axis], actualMax[axis]) }
    stats.vertices += positions.count

    const mode = primitive.mode ?? TRIANGLES
    let elementCount = positions.count
    if (primitive.indices !== undefined) {
      const indices = reader(primitive.indices, label + ' indices')
      if (!indices) return
      if (indices.components !== 1) { errors.push(label + ': indices must be SCALAR'); return }
      for (let i = 0; i < indices.count; i++) {
        if (indices.at(i, 0) >= positions.count) { errors.push(`${label}: index ${indices.at(i, 0)} at ${i} exceeds vertex count ${positions.count}`); return }
      }
      elementCount = indices.count
    }
    if (mode === TRIANGLES) {
      if (elementCount % 3 !== 0) errors.push(label + ': triangle list length is not a multiple of 3')
      stats.triangles += Math.floor(elementCount / 3)
    } else warnings.push(label + ': primitive mode ' + mode + ' is not a triangle list; not counted')
  }))
  if (Number.isFinite(min[0])) stats.bounds = { min, max }
  if (stats.bounds && stats.bounds.min.some((value, axis) => value === stats.bounds!.max[axis])) warnings.push('Bounds are flat along at least one axis')
  return { errors, warnings, stats }
}

/** Hex SHA-256 of the asset bytes, using Web Crypto (available in browsers and Node 18+). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type IntegrityVerdict = { status: 'RECORDED' | 'UNRECORDED' | 'CHANGED'; message: string }

/** Compares an asset's hash with the manifest record; content changes require a revision bump. */
export function integrityVerdict(entry: { revision: string; integrity?: { sha256: string; revision: string } }, actualSha: string): IntegrityVerdict {
  if (!entry.integrity) return { status: 'UNRECORDED', message: 'No integrity record; run npm run assets:record' }
  if (entry.integrity.sha256 === actualSha) {
    if (entry.integrity.revision !== entry.revision) return { status: 'CHANGED', message: `Revision changed to ${entry.revision} but geometry is identical to recorded revision ${entry.integrity.revision}; record it with npm run assets:record or revert the revision` }
    return { status: 'RECORDED', message: 'Matches recorded revision ' + entry.integrity.revision }
  }
  if (entry.integrity.revision === entry.revision) return { status: 'CHANGED', message: `Geometry changed but revision is still ${entry.revision}; bump the asset revision, then run npm run assets:record` }
  return { status: 'CHANGED', message: `Revision bumped to ${entry.revision}; run npm run assets:record to record the new geometry` }
}
