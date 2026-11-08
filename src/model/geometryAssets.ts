import { parts } from './components'

export type GeometryProvenance = 'SOURCED' | 'DERIVED' | 'ESTIMATED' | 'ILLUSTRATIVE' | 'UNKNOWN'
export type GeometryUnits = 'm' | 'mm' | 'cm' | 'in' | 'UNKNOWN'

export type GeometryAssetEntry = {
  componentId: string
  assetUri: string
  nodeNames: string[]
  system: string
  parentComponentId: string
  coordinateFrame: { name: string; handedness: 'RIGHT' | 'LEFT' }
  units: GeometryUnits
  provenance: GeometryProvenance
  source: { uri?: string; record: string; accessedAt?: string }
  licence: { spdxId?: string; permissionRecord?: string }
  revision: string
  /** SHA-256 of the asset file as recorded by `npm run assets:record`, and the asset revision it was recorded for. */
  integrity?: { sha256: string; revision: string }
}

export type GeometryAssetManifest = {
  schemaVersion: 1
  assetSetId: string
  revision: string
  entries: GeometryAssetEntry[]
}

const provenance = new Set<GeometryProvenance>(['SOURCED', 'DERIVED', 'ESTIMATED', 'ILLUSTRATIVE', 'UNKNOWN'])
const units = new Set<GeometryUnits>(['m', 'mm', 'cm', 'in', 'UNKNOWN'])
const componentIds = new Set(parts.map((part) => part.id))

export function validateGeometryManifest(value: unknown): string[] {
  const errors: string[] = []
  if (!value || typeof value !== 'object') return ['Manifest must be an object']
  const manifest = value as Partial<GeometryAssetManifest>
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (typeof manifest.assetSetId !== 'string' || !manifest.assetSetId.trim()) errors.push('assetSetId is required')
  if (typeof manifest.revision !== 'string' || !manifest.revision.trim()) errors.push('manifest revision is required')
  if (!Array.isArray(manifest.entries)) return [...errors, 'entries must be an array']

  const seen = new Set<string>()
  manifest.entries.forEach((entry, index) => {
    const prefix = `entries[${index}]`
    if (!entry || typeof entry !== 'object') { errors.push(prefix + ' must be an object'); return }
    const item = entry as GeometryAssetEntry
    if (!componentIds.has(item.componentId)) errors.push(prefix + ': unknown componentId ' + item.componentId)
    if (seen.has(item.componentId)) errors.push(prefix + ': duplicate componentId ' + item.componentId)
    seen.add(item.componentId)
    if (typeof item.assetUri !== 'string' || !item.assetUri.trim()) errors.push(prefix + ': assetUri is required')
    if (!Array.isArray(item.nodeNames) || item.nodeNames.length === 0 || item.nodeNames.some((name) => typeof name !== 'string' || !name.trim())) errors.push(prefix + ': nodeNames must contain at least one non-empty name')
    if (typeof item.system !== 'string' || !item.system.trim()) errors.push(prefix + ': system is required')
    if (typeof item.parentComponentId !== 'string' || !item.parentComponentId.trim()) errors.push(prefix + ': parentComponentId is required')
    if (!item.coordinateFrame || typeof item.coordinateFrame.name !== 'string' || !item.coordinateFrame.name.trim() || !['RIGHT', 'LEFT'].includes(item.coordinateFrame.handedness)) errors.push(prefix + ': coordinateFrame name and handedness are required')
    if (!units.has(item.units)) errors.push(prefix + ': units must be explicit or UNKNOWN')
    if (!provenance.has(item.provenance)) errors.push(prefix + ': invalid provenance')
    if (!item.source || typeof item.source.record !== 'string' || !item.source.record.trim()) errors.push(prefix + ': source record is required')
    if (!item.licence || (!item.licence.spdxId && !item.licence.permissionRecord)) errors.push(prefix + ': licence or permission record is required')
    if (typeof item.revision !== 'string' || !item.revision.trim()) errors.push(prefix + ': asset revision is required')
    if (item.integrity !== undefined && (!item.integrity || typeof item.integrity.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(item.integrity.sha256) || typeof item.integrity.revision !== 'string' || !item.integrity.revision.trim())) errors.push(prefix + ': integrity must have a 64-character lowercase hex sha256 and a revision')
  })
  return errors
}
