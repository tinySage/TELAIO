import { useEffect, useState } from 'react'
import { disposeComponentAsset, loadComponentAsset, type LoadedComponentAsset } from './loadGeometryAsset'
import { validateGeometryManifest, type GeometryAssetManifest } from '../model/geometryAssets'

export type GeometryAssetState = {
  status: 'loading' | 'ready' | 'error'
  message: string
  progress: number | null
  assets: Record<string, LoadedComponentAsset>
}

export function useGeometryAssets(manifestUri = '/geometry/manifest.json'): GeometryAssetState {
  const [state, setState] = useState<GeometryAssetState>({
    status: 'loading', message: 'Reading geometry manifest', progress: null, assets: {},
  })

  useEffect(() => {
    let cancelled = false
    const loaded: LoadedComponentAsset[] = []
    const disposeLoaded = () => loaded.splice(0).forEach(disposeComponentAsset)
    const run = async () => {
      try {
        const response = await fetch(manifestUri)
        if (!response.ok) throw new Error('Manifest request failed (' + response.status + ')')
        const value: unknown = await response.json()
        const errors = validateGeometryManifest(value)
        if (errors.length) throw new Error('Manifest validation failed: ' + errors.join('; '))
        const manifest = value as GeometryAssetManifest
        if (manifest.entries.length === 0) {
          if (!cancelled) setState({ status: 'ready', message: 'Procedural fallback · no GLB assets configured', progress: null, assets: {} })
          return
        }

        let completed = 0
        const results = await Promise.allSettled(manifest.entries.map(async (entry) => {
          const asset = await loadComponentAsset(entry, (progress) => {
            if (cancelled) return
            const fraction = progress.ratio ?? 0
            setState((current) => ({ ...current, status: 'loading', message: 'Loading ' + entry.componentId, progress: (completed + fraction) / manifest.entries.length }))
          })
          if (cancelled) disposeComponentAsset(asset)
          else loaded.push(asset)
          completed++
          return asset
        }))
        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        if (failures.length) {
          disposeLoaded()
          throw failures[0].reason
        }
        const assets = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
        if (cancelled) { disposeLoaded(); return }
        setState({ status: 'ready', message: assets.length + ' component asset(s) loaded', progress: 1, assets: Object.fromEntries(assets.map((asset) => [asset.componentId, asset])) })
      } catch (error) {
        disposeLoaded()
        if (!cancelled) setState({ status: 'error', message: (error instanceof Error ? error.message : 'Geometry asset loading failed') + ' · procedural fallback active', progress: null, assets: {} })
      }
    }
    void run()
    return () => { cancelled = true; disposeLoaded() }
  }, [manifestUri])

  return state
}
