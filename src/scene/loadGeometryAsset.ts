import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GeometryAssetEntry } from '../model/geometryAssets'

export type LoadedComponentAsset = {
  componentId: string
  group: THREE.Group
  meshCount: number
  triangleCount: number
  bounds: THREE.Box3
}

export type AssetLoadProgress = { loaded: number; total: number; ratio: number | null }

export class GeometryAssetLoadError extends Error {
  constructor(message: string, readonly componentId?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GeometryAssetLoadError'
  }
}

function validateMesh(mesh: THREE.Mesh, componentId: string): number {
  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  if (!position || position.count === 0) throw new GeometryAssetLoadError('Mesh has no vertex positions', componentId)
  for (let index = 0; index < position.count; index++) {
    if (![position.getX(index), position.getY(index), position.getZ(index)].every(Number.isFinite)) {
      throw new GeometryAssetLoadError('Mesh contains non-finite vertex coordinates', componentId)
    }
  }
  const indices = geometry.getIndex()
  if (indices) {
    for (let index = 0; index < indices.count; index++) {
      if (indices.getX(index) >= position.count) throw new GeometryAssetLoadError('Mesh index exceeds vertex count', componentId)
    }
  }
  return indices ? Math.floor(indices.count / 3) : Math.floor(position.count / 3)
}

function cloneMaterial(source: THREE.Material): THREE.Material {
  const clone = source.clone()
  Object.keys(source).forEach((key) => {
    const value = (source as unknown as Record<string, unknown>)[key]
    if (value instanceof THREE.Texture) {
      const texture = value.clone()
      texture.needsUpdate = true
      ;(clone as unknown as Record<string, unknown>)[key] = texture
    }
  })
  return clone
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    node.geometry.dispose()
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose()
      })
      material.dispose()
    })
  })
  group.clear()
}

export function loadComponentAsset(
  entry: GeometryAssetEntry,
  onProgress?: (progress: AssetLoadProgress) => void,
): Promise<LoadedComponentAsset> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(entry.assetUri, (gltf) => {
      const root = new THREE.Group()
      root.name = entry.componentId
      try {
        const names = new Set(entry.nodeNames)
        let meshCount = 0
        let triangleCount = 0
        gltf.scene.updateMatrixWorld(true)
        gltf.scene.traverse((node) => {
          if (!(node instanceof THREE.Mesh) || !names.has(node.name)) return
          const mesh = node.clone()
          mesh.geometry = node.geometry.clone()
          mesh.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material)
          mesh.matrixAutoUpdate = false
          mesh.matrix.copy(node.matrixWorld)
          mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
          mesh.matrixAutoUpdate = true
          triangleCount += validateMesh(mesh, entry.componentId)
          mesh.castShadow = true
          mesh.receiveShadow = true
          root.add(mesh)
          meshCount++
        })
        if (meshCount === 0) throw new GeometryAssetLoadError('No GLB nodes matched manifest nodeNames: ' + entry.nodeNames.join(', '), entry.componentId)
        root.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(root)
        if (bounds.isEmpty()) throw new GeometryAssetLoadError('Loaded component has empty bounds', entry.componentId)
        resolve({ componentId: entry.componentId, group: root, meshCount, triangleCount, bounds })
      } catch (error) {
        disposeGroup(root)
        reject(error instanceof Error ? error : new GeometryAssetLoadError('Unknown asset validation error', entry.componentId))
      }
    }, (event) => {
      const total = event.total > 0 ? event.total : 0
      onProgress?.({ loaded: event.loaded, total, ratio: total ? event.loaded / total : null })
    }, (error) => reject(new GeometryAssetLoadError('Unable to load GLB asset: ' + entry.assetUri, entry.componentId, { cause: error })))
  })
}

export function disposeComponentAsset(asset: LoadedComponentAsset): void {
  disposeGroup(asset.group)
}
