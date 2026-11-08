/**
 * Geometry asset pipeline check. Run with `npm run assets:check` (CI) or `npm run assets:record`.
 *
 * check:  validates the manifest schema, then for each asset file: glTF structure, buffer and accessor
 *         ranges, declared bounds, indices and manifest node names; compares its SHA-256 with the
 *         manifest's integrity record. Exits non-zero on any error or changed geometry.
 * record: writes integrity records for assets whose content is new or whose revision was bumped.
 *         Refuses to re-record changed geometry under an unchanged revision.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { checkGltf, integrityVerdict, resolveBuffers, sha256Hex, type GltfJson } from '../src/model/assetChecks'
import { validateGeometryManifest, type GeometryAssetManifest } from '../src/model/geometryAssets'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const publicDir = join(root, 'public')
const manifestPath = join(publicDir, 'geometry', 'manifest.json')
const record = process.argv.includes('--record')

const fmt = (n: number) => n.toFixed(3)
let failed = false
const fail = (message: string) => { failed = true; console.error('  ✗ ' + message) }

const manifestText = await readFile(manifestPath, 'utf8')
const manifest = JSON.parse(manifestText) as GeometryAssetManifest
const schemaErrors = validateGeometryManifest(manifest)
console.log(`Manifest ${manifest.assetSetId} rev ${manifest.revision}: ${manifest.entries?.length ?? 0} entries`)
schemaErrors.forEach(fail)
if (schemaErrors.length) process.exit(1)

const cache = new Map<string, { bytes: Uint8Array; sha: string; result: ReturnType<typeof checkGltf> | null; error?: string }>()
let recorded = 0
for (const entry of manifest.entries) {
  console.log(`\n${entry.componentId}  ←  ${entry.assetUri}  (rev ${entry.revision}, ${entry.provenance}, units ${entry.units})`)
  if (!cache.has(entry.assetUri)) {
    const path = join(publicDir, entry.assetUri.replace(/^\//, ''))
    try {
      const bytes = new Uint8Array(await readFile(path))
      const sha = await sha256Hex(bytes)
      if (path.endsWith('.glb')) { cache.set(entry.assetUri, { bytes, sha, result: null, error: 'Binary .glb assets are not yet supported by this checker' }); continue }
      const gltf = JSON.parse(new TextDecoder().decode(bytes)) as GltfJson
      const buffers = await resolveBuffers(gltf, async (uri) => { try { return new Uint8Array(await readFile(join(dirname(path), uri))) } catch { return null } })
      cache.set(entry.assetUri, { bytes, sha, result: checkGltf(gltf, buffers) })
    } catch (error) {
      cache.set(entry.assetUri, { bytes: new Uint8Array(), sha: '', result: null, error: 'Unreadable asset: ' + (error as Error).message })
    }
  }
  const asset = cache.get(entry.assetUri)!
  if (asset.error || !asset.result) { fail(asset.error ?? 'Asset could not be checked'); continue }
  const { errors, warnings, stats } = asset.result
  const missingNodes = entry.nodeNames.filter((name) => !stats.nodeNames.includes(name))
  errors.forEach(fail)
  missingNodes.forEach((name) => fail('Manifest node name not found in asset: ' + name))
  warnings.forEach((warning) => console.log('  ! ' + warning))
  if (entry.units === 'UNKNOWN') console.log('  ! Units UNKNOWN: geometry is dimensionless study geometry')
  const size = stats.bounds ? stats.bounds.max.map((value, axis) => fmt(value - stats.bounds!.min[axis])).join(' × ') : 'n/a'
  console.log(`  ${stats.meshes} mesh, ${stats.primitives} primitives, ${stats.triangles} triangles, ${stats.vertices} vertices · extent ${size} (asset units)`)
  console.log(`  sha256 ${asset.sha.slice(0, 16)}…`)

  const verdict = integrityVerdict(entry, asset.sha)
  if (record && verdict.status !== 'RECORDED') {
    if (entry.integrity && entry.integrity.sha256 !== asset.sha && entry.integrity.revision === entry.revision) fail(verdict.message)
    else { entry.integrity = { sha256: asset.sha, revision: entry.revision }; recorded++; console.log(`  ✓ recorded integrity for rev ${entry.revision}`) }
  } else if (verdict.status === 'RECORDED') console.log('  ✓ ' + verdict.message)
  else if (verdict.status === 'UNRECORDED') fail(verdict.message)
  else fail(verdict.message)
}

if (record && recorded && !failed) {
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\nRecorded ${recorded} integrity record(s) in public/geometry/manifest.json`)
}
console.log(failed ? '\nAsset check FAILED' : '\nAsset check passed')
process.exit(failed ? 1 : 0)
