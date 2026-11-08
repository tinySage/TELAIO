import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkGltf, integrityVerdict, resolveBuffers, sha256Hex, type GltfJson } from './assetChecks'
import { validateGeometryManifest } from './geometryAssets'

const publicDir = join(__dirname, '..', '..', 'public', 'geometry')
const rotorText = readFileSync(join(publicDir, 'brake-disc.gltf'), 'utf8')
const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.json'), 'utf8'))
const noExternal = async () => null
const load = async (gltf: GltfJson) => checkGltf(gltf, await resolveBuffers(gltf, noExternal), ['BrakeRotorAssembly'])
const rotor = () => JSON.parse(rotorText) as GltfJson

/** Minimal valid glTF: one indexed triangle in an embedded buffer. */
function triangle(indices: number[] = [0, 1, 2]) {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const index = new Uint16Array(indices)
  const bytes = new Uint8Array(positions.byteLength + index.byteLength)
  bytes.set(new Uint8Array(positions.buffer), 0)
  bytes.set(new Uint8Array(index.buffer), positions.byteLength)
  const uri = 'data:application/octet-stream;base64,' + btoa(String.fromCharCode(...bytes))
  return {
    asset: { version: '2.0' }, nodes: [{ name: 'Tri', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5123, count: index.length, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: index.byteLength }],
    buffers: [{ uri, byteLength: bytes.byteLength }],
  } satisfies GltfJson
}

describe('glTF asset checks', () => {
  it('passes the committed brake rotor and reports its geometry', async () => {
    const { errors, stats } = await load(rotor())
    expect(errors).toEqual([])
    expect(stats).toMatchObject({ meshes: 1, primitives: 4, materials: 4, nodeNames: ['BrakeRotorAssembly'] })
    expect(stats.triangles).toBe(2712)
    expect(stats.bounds?.min[1]).toBeCloseTo(-0.3)
    expect(stats.bounds?.max[2]).toBeCloseTo(0.3)
  })

  it('passes a minimal indexed triangle', async () => {
    const gltf = triangle()
    const result = checkGltf(gltf, await resolveBuffers(gltf, noExternal), ['Tri'])
    expect(result.errors).toEqual([])
    expect(result.stats.triangles).toBe(1)
  })

  it('rejects a wrong glTF version and missing manifest node names', async () => {
    const gltf = { ...rotor(), asset: { version: '1.0' } }
    const result = checkGltf(gltf, await resolveBuffers(gltf, noExternal), ['NoSuchNode'])
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('asset.version'), expect.stringContaining('NoSuchNode')]))
  })

  it('rejects a bufferView that runs past its buffer', async () => {
    const gltf = rotor()
    gltf.bufferViews![0].byteLength = 10_000_000
    expect((await load(gltf)).errors.some((error) => error.includes('beyond buffer length'))).toBe(true)
  })

  it('rejects declared bounds that do not match the vertex data', async () => {
    const gltf = rotor()
    gltf.accessors![0].max = [9, 9, 9]
    expect((await load(gltf)).errors.some((error) => error.includes('do not match'))).toBe(true)
  })

  it('rejects out-of-range indices and incomplete triangles', async () => {
    const bad = triangle([0, 1, 7])
    expect(checkGltf(bad, await resolveBuffers(bad, noExternal)).errors.some((e) => e.includes('exceeds vertex count'))).toBe(true)
    const partial = triangle([0, 1])
    expect(checkGltf(partial, await resolveBuffers(partial, noExternal)).errors.some((e) => e.includes('multiple of 3'))).toBe(true)
  })

  it('reports unresolvable external buffers', async () => {
    const gltf = { ...triangle(), buffers: [{ uri: 'missing.bin', byteLength: 42 }] }
    expect(checkGltf(gltf, await resolveBuffers(gltf, noExternal)).errors.some((e) => e.includes('could not be resolved'))).toBe(true)
  })
})

describe('asset integrity and revisions', () => {
  it('every manifest entry carries an integrity record matching the committed file', async () => {
    expect(validateGeometryManifest(manifest)).toEqual([])
    const sha = await sha256Hex(new Uint8Array(readFileSync(join(publicDir, 'brake-disc.gltf'))))
    for (const entry of manifest.entries) expect(integrityVerdict(entry, sha).status, entry.componentId).toBe('RECORDED')
  })

  it('requires a revision bump when geometry changes', () => {
    const entry = { revision: '0.1.0', integrity: { sha256: 'a'.repeat(64), revision: '0.1.0' } }
    expect(integrityVerdict(entry, 'a'.repeat(64)).status).toBe('RECORDED')
    expect(integrityVerdict(entry, 'b'.repeat(64))).toMatchObject({ status: 'CHANGED', message: expect.stringContaining('bump the asset revision') })
    expect(integrityVerdict({ ...entry, revision: '0.2.0' }, 'b'.repeat(64)).message).toContain('assets:record')
    expect(integrityVerdict({ revision: '0.1.0' }, 'a'.repeat(64)).status).toBe('UNRECORDED')
  })

  it('rejects malformed integrity records in the manifest', () => {
    const broken = structuredClone(manifest)
    broken.entries[0].integrity = { sha256: 'XYZ', revision: '' }
    expect(validateGeometryManifest(broken).some((error) => error.includes('integrity'))).toBe(true)
  })
})
