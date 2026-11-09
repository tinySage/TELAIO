import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { evaluate, resolveParameters } from './expr'
import { centroid, featureGeometry, meshVolume, planePoint, resolveDesign, selfIntersects, signedArea, type Feature, type P2 } from './solids'
import { bounds, dimensionLayout, dimensionValue, meshEdges, parseCommand, project, snap, snapTargets } from './drafting'
import { exampleDesign, parseDesign } from './design'
import { partDrawingGeometry } from './partGeometry'
import { parts } from '../model/components'

describe('parameter expressions', () => {
  it('follows precedence, unary minus, powers, functions in degrees and pi', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7)
    expect(evaluate('-2^2')).toBe(-4)
    expect(evaluate('2^3^2')).toBe(512)
    expect(evaluate('(1 + 2) * 3 / 4')).toBe(2.25)
    expect(evaluate('sin(30)')).toBeCloseTo(0.5, 12)
    expect(evaluate('max(1, 4, 2) + sqrt(9)')).toBe(7)
    expect(evaluate('2 * pi')).toBeCloseTo(2 * Math.PI, 12)
  })
  it('rejects malformed input rather than returning zero', () => {
    for (const bad of ['', '1 +', '2 $ 3', '(1', 'sqrt()', 'sqrt(1, 2)', '1 / 0', 'foo']) expect(() => evaluate(bad)).toThrow()
  })
  it('resolves parameters in any order and reports cycles, bad names and duplicates', () => {
    const { values, errors } = resolveParameters([
      { name: 'b', expr: 'a * 2' }, { name: 'a', expr: '3' }, { name: 'c1', expr: 'c2' }, { name: 'c2', expr: 'c1 + 1' },
      { name: 'pi', expr: '1' }, { name: 'bad', expr: 'missing + 1' },
    ])
    expect(values).toEqual({ a: 3, b: 6 })
    expect(resolveParameters([{ name: 'a', expr: '1' }, { name: 'a', expr: '2' }]).errors.a).toBe('Duplicate name')
    expect(errors.c1).toMatch(/Circular/)
    expect(errors.c2).toBeDefined()
    expect(errors.pi).toMatch(/reserved/)
    expect(errors.bad).toMatch(/Unknown parameter "missing"/)
  })
})

const square: P2[] = [[0, 0], [2, 0], [2, 1], [0, 1]]
const feature = (over: Partial<Feature>): Feature => ({ id: 'f', name: 'F', plane: 'XY', offset: '0', visible: true, profile: { kind: 'rect', cu: '1', cv: '0.5', width: '2', height: '1' }, op: { kind: 'extrude', depth: '3', symmetric: false }, ...over })

describe('sketch profiles', () => {
  it('computes area and centroid by the shoelace formula', () => {
    expect(signedArea(square)).toBe(2)
    expect(signedArea([...square].reverse())).toBe(-2)
    expect(centroid(square)).toEqual([1, 0.5])
    const tri: P2[] = [[0, 0], [3, 0], [0, 3]]
    expect(centroid(tri)).toEqual([1, 1])
  })
  it('detects self-intersecting (bow-tie) profiles', () => {
    expect(selfIntersects(square)).toBe(false)
    expect(selfIntersects([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(true)
  })
})

describe('solid features', () => {
  it('extrusion volume is area × depth, and the display mesh encloses the same volume', () => {
    const { features: [f] } = resolveDesign({ params: [], features: [feature({})] })
    expect(f.issues).toEqual([])
    expect(f.volume).toBe(6)
    expect(meshVolume(featureGeometry(f)!)).toBeCloseTo(6, 9)
  })
  it('revolution volume follows Pappus, checked against the mesh: a hollow cylinder', () => {
    // Rectangle r ∈ [1, 2], height 3, revolved fully about the v axis: V = π(2² − 1²)·3 = 9π.
    const f = feature({ profile: { kind: 'polygon', points: [['1', '0'], ['2', '0'], ['2', '3'], ['1', '3']] }, op: { kind: 'revolve', axis: 'v', angle: '360' } })
    const { features: [r] } = resolveDesign({ params: [], features: [f] })
    expect(r.volume).toBeCloseTo(9 * Math.PI, 12)
    // The polygonal lathe slightly under-fills the circle: within 0.1 %.
    expect(meshVolume(featureGeometry(r)!) / r.volume! - 1).toBeLessThan(0)
    expect(Math.abs(meshVolume(featureGeometry(r)!) / r.volume! - 1)).toBeLessThan(1e-3)
    const half = resolveDesign({ params: [], features: [{ ...f, op: { kind: 'revolve', axis: 'v', angle: '180' } }] }).features[0]
    expect(half.volume).toBeCloseTo(4.5 * Math.PI, 12)
  })
  it('places geometry on the sketch plane: a symmetric extrusion straddles the plane offset', () => {
    const f = feature({ plane: 'YZ', offset: '5', op: { kind: 'extrude', depth: '2', symmetric: true } })
    const g = featureGeometry(resolveDesign({ params: [], features: [f] }).features[0])!
    g.computeBoundingBox()
    // YZ: u = y, v = z, normal x. Rect u ∈ [0, 2], v ∈ [0, 1]; x ∈ [4, 6].
    expect(g.boundingBox!.min.toArray().map((v) => +v.toFixed(9))).toEqual([4, 0, 0])
    expect(g.boundingBox!.max.toArray().map((v) => +v.toFixed(9))).toEqual([6, 2, 1])
    expect(planePoint('ZX', 1, 2, 3)).toEqual([2, 3, 1])
  })
  it('regenerates from parameters: changing one parameter changes every dependent dimension', () => {
    const f = feature({ profile: { kind: 'circle', cu: '0', cv: '0', radius: 'r' }, op: { kind: 'extrude', depth: 'r * 4', symmetric: false } })
    const v = (r: string) => resolveDesign({ params: [{ name: 'r', expr: r }], features: [f] }).features[0].volume!
    expect(v('1') * 8).toBeCloseTo(v('2'), 9) // V ∝ r³
  })
  it('reports problems instead of producing geometry', () => {
    const issues = (f: Feature) => resolveDesign({ params: [], features: [f] }).features[0].issues
    expect(issues(feature({ op: { kind: 'extrude', depth: '-1', symmetric: false } }))).toContain('Depth must be positive')
    expect(issues(feature({ offset: 'nope' }))[0]).toMatch(/Plane offset: Unknown parameter/)
    expect(issues(feature({ profile: { kind: 'polygon', points: [['0', '0'], ['1', '1'], ['1', '0'], ['0', '1']] } }))).toContain('Profile edges cross each other')
    expect(issues(feature({ profile: { kind: 'polygon', points: [['-1', '0'], ['1', '0'], ['1', '1']] }, op: { kind: 'revolve', axis: 'v', angle: '360' } }))).toContain('Profile crosses the revolve axis')
    expect(featureGeometry(resolveDesign({ params: [], features: [feature({ op: { kind: 'extrude', depth: '0', symmetric: false } })] }).features[0])).toBeNull()
  })
  it('the example design resolves cleanly and survives a storage round trip', () => {
    const d = exampleDesign()
    const resolved = resolveDesign(d)
    expect(resolved.features.flatMap((f) => f.issues)).toEqual([])
    expect(Object.keys(resolved.params.errors)).toEqual([])
    expect(parseDesign(JSON.stringify(d))).toEqual(d)
    expect(parseDesign('{"features":[{"id":1}],"params":"x"}').features).toEqual([])
  })
})

describe('drafting projections', () => {
  it('projects the study frame into side, top and front views', () => {
    expect(project('side', [1, 2, 3])).toEqual([1, 2])
    expect(project('top', [1, 2, 3])).toEqual([-3, 1])
    expect(project('front', [1, 2, 3])).toEqual([3, 2])
  })
  it('draws a box as its outline: edges seen end-on vanish', () => {
    const g = new THREE.BoxGeometry(2, 1, 4)
    const edges = meshEdges(g, 'side')
    expect(bounds(edges)).toEqual({ min: [-1, -0.5], max: [1, 0.5] })
    for (const [a, b] of edges) expect([a, b].every(([u, v]) => Math.abs(Math.abs(u) - 1) < 1e-9 || Math.abs(Math.abs(v) - 0.5) < 1e-9)).toBe(true)
  })
  it('draws the silhouette of a smooth surface: a torus seen along its axis spans R + r', () => {
    const g = new THREE.TorusGeometry(1, 0.25, 24, 64) // axis along z
    const b = bounds(meshEdges(g, 'side'))!
    expect(b.max[0]).toBeCloseTo(1.25, 2)
    expect(b.min[1]).toBeCloseTo(-1.25, 2)
    // Edge-on (from the front, looking along x) the outline height is the tube diameter.
    const f = bounds(meshEdges(g, 'front'))!
    expect(f.max[1] - f.min[1]).toBeCloseTo(2.5, 2)
    expect(f.max[0] - f.min[0]).toBeCloseTo(0.5, 2)
  })
  it('produces drawable geometry for every procedural part', () => {
    for (const p of parts) {
      const g = partDrawingGeometry(p)
      expect(g.meshes.length + g.lines.length).toBeGreaterThan(0)
    }
  })
})

describe('dimensions, snapping and the command line', () => {
  it('measures aligned, horizontal and vertical dimensions', () => {
    expect(dimensionValue('aligned', [0, 0], [3, 4])).toBe(5)
    expect(dimensionValue('horizontal', [0, 0], [3, 4])).toBe(3)
    expect(dimensionValue('vertical', [0, 0], [3, -4])).toBe(4)
    expect(dimensionLayout('horizontal', [0, 0], [3, 4], 0.5).line).toEqual([[0, 4.5], [3, 4.5]])
  })
  it('snaps to endpoints before midpoints before the grid', () => {
    const t = snapTargets([[[0, 0], [1, 0]]])
    expect(snap([0.98, 0.01], t, 0.05, 0.1)).toEqual({ point: [1, 0], kind: 'endpoint' })
    expect(snap([0.51, 0.02], t, 0.05, 0.1)).toEqual({ point: [0.5, 0], kind: 'midpoint' })
    expect(snap([0.31, 0.38], t, 0.05, 0.25)).toEqual({ point: [0.25, 0.5], kind: 'grid' })
    expect(snap([0.31, 0.38], t, 0.05, null)).toEqual({ point: [0.31, 0.38], kind: 'free' })
  })
  it('parses commands with absolute and relative points', () => {
    expect(parseCommand('line 0,0 1,0 @0,0.5').command).toEqual({ action: 'line', points: [[0, 0], [1, 0], [1, 0.5]] })
    expect(parseCommand('L @1,1', [2, 2]).command).toEqual(null)
    expect(parseCommand('L @1,1 @1,0', [2, 2]).command).toEqual({ action: 'line', points: [[3, 3], [4, 3]] })
    expect(parseCommand('DIM 0,0 2,1 h 0.2').command).toEqual({ action: 'dimension', dim: 'horizontal', a: [0, 0], b: [2, 1], offset: 0.2 })
    expect(parseCommand('note 1,2 Lower wishbone pickup').command).toEqual({ action: 'note', at: [1, 2], text: 'Lower wishbone pickup' })
    expect(parseCommand('grid off').command).toEqual({ action: 'grid', size: null })
    expect(parseCommand('view top').command).toEqual({ action: 'view', view: 'top' })
    expect(parseCommand('L @1,1').error).toMatch(/no previous point/)
    expect(parseCommand('DIM 0,0 1,1 Q').error).toMatch(/A, H or V/)
    expect(parseCommand('EXPLODE').error).toMatch(/Unknown command/)
    expect(parseCommand('   ')).toEqual({ command: null, error: null })
  })
})
