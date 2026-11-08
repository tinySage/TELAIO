import { describe, expect, it } from 'vitest'
import { addMeasurePoint, angleDegrees, clampSectionOffset, describeMeasurement, distance, keptBySection, sectionPlane } from './cad'
import { parseViewStates, restoreErrors, upsertViewState, type ViewState } from './viewStates'
import { parts } from './components'

const allIds = parts.map((part) => part.id)

describe('section planes', () => {
  it('keeps geometry at or below the offset by default, and above it when flipped', () => {
    const settings = { axis: 'x' as const, offset: 0.5, flip: false }
    expect(keptBySection([0.4, 9, 9], settings)).toBe(true)
    expect(keptBySection([0.5, 0, 0], settings)).toBe(true)
    expect(keptBySection([0.6, 0, 0], settings)).toBe(false)
    expect(keptBySection([0.6, 0, 0], { ...settings, flip: true })).toBe(true)
    expect(keptBySection([0.4, 0, 0], { ...settings, flip: true })).toBe(false)
  })

  it('produces a unit normal on the chosen axis', () => {
    expect(sectionPlane({ axis: 'z', offset: 0.2, flip: false })).toEqual({ normal: [0, 0, -1], constant: 0.2 })
    expect(sectionPlane({ axis: 'y', offset: -0.3, flip: true }).normal).toEqual([0, 1, 0])
  })

  it('a centreline z-section through the car keeps exactly the left-hand corners', () => {
    const settings = { axis: 'z' as const, offset: 0, flip: true }
    for (const id of ['brake-disc', 'front-upright', 'rear-upright', 'rear-left-brake-caliper']) expect(keptBySection(parts.find((p) => p.id === id)!.position, settings), id).toBe(true)
    for (const id of ['front-right-brake-disc', 'front-right-upright', 'rear-right-upright']) expect(keptBySection(parts.find((p) => p.id === id)!.position, settings), id).toBe(false)
  })

  it('clamps offsets to the axis range', () => {
    expect(clampSectionOffset('y', 5)).toBe(1)
    expect(clampSectionOffset('x', -9)).toBe(-2.4)
  })
})

describe('measurement', () => {
  it('measures distance and angle', () => {
    expect(distance([0, 0, 0], [3, 4, 0])).toBeCloseTo(5)
    expect(angleDegrees([1, 0, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(90)
    expect(angleDegrees([1, 0, 0], [0, 0, 0], [-1, 0, 0])).toBeCloseTo(180)
    expect(angleDegrees([0, 0, 0], [0, 0, 0], [1, 0, 0])).toBeNull()
  })

  it('reports values in study units, never physical units', () => {
    const result = describeMeasurement('distance', [[0, 0, 0], [0, 0, 1.5]])!
    expect(result).toMatchObject({ complete: true, value: '1.500 study units' })
    expect(result.value).not.toMatch(/mm|cm|\bm\b|inch/)
  })

  it('measures the front track between the two front wheel centres', () => {
    const [left, right] = ['wheel-tyre', 'front-right-wheel'].map((id) => parts.find((p) => p.id === id)!.position)
    expect(describeMeasurement('distance', [left, right])!.value).toBe('1.920 study units')
  })

  it('prompts for points until complete, then starts a new measurement', () => {
    expect(describeMeasurement('angle', [[0, 0, 0]])).toMatchObject({ complete: false, value: 'Pick the vertex' })
    const full = addMeasurePoint('distance', addMeasurePoint('distance', [], [0, 0, 0]), [1, 0, 0])
    expect(full).toHaveLength(2)
    expect(addMeasurePoint('distance', full, [5, 5, 5])).toEqual([[5, 5, 5]])
    expect(addMeasurePoint('off', full, [1, 1, 1])).toEqual([])
  })
})

describe('saved view states', () => {
  const state = (overrides: Partial<ViewState> = {}): ViewState => ({ name: 'Brake service', savedAt: '2026-11-09T00:00:00Z', explode: 0.4, hiddenIds: ['wheel-tyre'], isolatedId: null, installedIds: allIds, section: { axis: 'z', offset: 0.3, flip: false }, ...overrides })

  it('round-trips through storage', () => {
    const parsed = parseViewStates(JSON.stringify([state()]))
    expect(parsed).toEqual({ states: [state()], warnings: [] })
  })

  it('drops unknown IDs, malformed entries and out-of-range values with warnings', () => {
    const parsed = parseViewStates(JSON.stringify([state({ hiddenIds: ['wheel-tyre', 'flux-capacitor'], explode: 7, section: { axis: 'y', offset: 99, flip: false } }), { nope: true }]))
    expect(parsed.states).toHaveLength(1)
    expect(parsed.states[0]).toMatchObject({ hiddenIds: ['wheel-tyre'], explode: 1, section: { axis: 'y', offset: 1 } })
    expect(parsed.warnings).toHaveLength(2)
    expect(parseViewStates('{not json').warnings).toHaveLength(1)
  })

  it('refuses to restore an installed set that breaks prerequisite rules', () => {
    expect(restoreErrors(state())).toEqual([])
    expect(restoreErrors(state({ installedIds: allIds.filter((id) => id !== 'brake-disc') })).length).toBeGreaterThan(0)
  })

  it('replaces a state with the same name and keeps the newest first', () => {
    const states = upsertViewState(upsertViewState([], state({ name: 'A' })), state({ name: 'B' }))
    expect(upsertViewState(states, state({ name: 'A', explode: 1 })).map((s) => [s.name, s.explode])).toEqual([['A', 1], ['B', 0.4]])
  })
})

describe('interface inspection', () => {
  const byId = new Map(parts.map((part) => [part.id, part]))
  it('lists interfaces in both directions', async () => {
    const { relationsFor } = await import('./assembly')
    const caliper = relationsFor('brake-caliper')
    expect(caliper.outgoing.map((edge) => edge.targetId).sort()).toEqual(['caliper-mount', 'pad-inner-backing', 'pad-outer-backing'])
    expect(caliper.incoming.map((edge) => edge.ownerId).sort()).toEqual(['caliper-mount', 'master-cylinder-front'])
  })

  it('draws one link per related visible part, from the selected anchor, honouring explode', async () => {
    const { interfaces } = await import('./assembly')
    const { interfaceLinks, partAnchor } = await import('./cad')
    const links = interfaceLinks('brake-caliper', byId, interfaces, 0.5, () => true)
    expect(links).toHaveLength(5)
    for (const link of links) expect(link.from).toEqual(partAnchor(byId.get('brake-caliper')!, 0.5))
    expect(links.find((link) => link.id === 'mc-front-fl')).toMatchObject({ direction: 'incoming', type: 'CONCEPTUAL' })
    expect(interfaceLinks('brake-caliper', byId, interfaces, 0, (id) => id !== 'master-cylinder-front')).toHaveLength(4)
  })

  it('anchors rods at the mean of their segment ends', async () => {
    const { partAnchor } = await import('./cad')
    expect(partAnchor({ ...byId.get('halo')!, explode: [0, 0, 0] }, 1)[2]).toBeCloseTo(0)
  })
})
