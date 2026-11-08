import { describe, expect, it } from 'vitest'
import { FRONT_HARDPOINTS, REAR_HARDPOINTS, mirror, type CornerHardpoints } from '../model/hardpoints'
import { parts } from '../model/components'
import { rollCentreHeight, solveCorner, summarise, sweepTravel } from './suspension'
import { quantity, unknown } from './quantity'

/** Front-view parallelogram: equal, parallel, horizontal arms and tie rod; upright vertical. */
const parallelogram: CornerHardpoints = {
  corner: 'front',
  links: [
    { id: 'lower-front', label: 'LF', inboard: [1.2, -0.3, 0.16], outboard: [0.9, -0.3, 0.8] },
    { id: 'lower-rear', label: 'LR', inboard: [0.6, -0.3, 0.16], outboard: [0.9, -0.3, 0.8] },
    { id: 'upper-front', label: 'UF', inboard: [1.2, 0.3, 0.16], outboard: [0.9, 0.3, 0.8] },
    { id: 'upper-rear', label: 'UR', inboard: [0.6, 0.3, 0.16], outboard: [0.9, 0.3, 0.8] },
    { id: 'tie-rod', label: 'TR', inboard: [0.74, 0, 0.16], outboard: [0.74, 0, 0.8] },
  ],
  actuation: FRONT_HARDPOINTS.actuation,
  wheelCentre: [0.9, 0, 0.96], spinAxisPoint: [0.9, 0, 0.86], tyreRadius: 0.64,
}

const mirrorCorner = (h: CornerHardpoints): CornerHardpoints => ({
  ...h,
  links: h.links.map((link) => ({ ...link, inboard: mirror(link.inboard), outboard: mirror(link.outboard) })),
  actuation: { ...h.actuation, inboard: mirror(h.actuation.inboard), outboard: mirror(h.actuation.outboard) },
  wheelCentre: mirror(h.wheelCentre), spinAxisPoint: mirror(h.spinAxisPoint),
})

describe('suspension kinematics solver', () => {
  it('closes every constraint at static with zero camber and toe', () => {
    for (const h of [FRONT_HARDPOINTS, REAR_HARDPOINTS]) {
      const s = solveCorner(h, 0)!
      expect(s.residual).toBeLessThan(1e-9)
      expect(s.camberDeg).toBeCloseTo(0, 9)
      expect(s.toeDeg).toBeCloseTo(0, 9)
    }
  })

  it('solves a full travel sweep with closed constraints and the requested travel', () => {
    const sweep = sweepTravel(FRONT_HARDPOINTS, 0.08, 16)
    expect(sweep).toHaveLength(17)
    for (const s of sweep) {
      expect(s.residual).toBeLessThan(1e-9)
      expect(s.wheelCentre[1] - FRONT_HARDPOINTS.wheelCentre[1]).toBeCloseTo(s.travel, 9)
    }
  })

  it('a parallelogram keeps camber and toe at exactly zero throughout travel', () => {
    for (const s of sweepTravel(parallelogram, 0.1, 10)) {
      expect(Math.abs(s.camberDeg)).toBeLessThan(1e-6)
      expect(Math.abs(s.toeDeg)).toBeLessThan(1e-6)
    }
  })

  it('a parallelogram with horizontal arms has its roll centre at ground level', () => {
    expect(rollCentreHeight(parallelogram)).toBeCloseTo(0, 9)
  })

  it('at static, a parallelogram upright translates vertically, so motion ratio is the rod’s vertical direction cosine', () => {
    const { outboard, inboard } = parallelogram.actuation
    const d = [outboard[0] - inboard[0], outboard[1] - inboard[1], outboard[2] - inboard[2]]
    const expected = Math.abs(d[1]) / Math.hypot(...d)
    const summary = summarise(parallelogram, 'ILLUSTRATIVE', { springRate: unknown('N/mm'), rockerRatio: unknown('ratio'), damperCoefficient: unknown('N·s/m'), cornerMass: unknown('kg') })
    expect(summary.motionRatio.value).toBeCloseTo(expected, 5)
  })

  it('the default front gains negative camber in bump (shorter upper arm) and is mirror-symmetric', () => {
    const left = sweepTravel(FRONT_HARDPOINTS, 0.06, 6), right = sweepTravel(mirrorCorner(FRONT_HARDPOINTS), 0.06, 6)
    const bump = left[left.length - 1]
    expect(bump.camberDeg).toBeLessThan(-0.1)
    left.forEach((s, i) => {
      expect(right[i].camberDeg).toBeCloseTo(s.camberDeg, 8)
      expect(right[i].toeDeg).toBeCloseTo(s.toeDeg, 8)
    })
  })

  it('the default front tie rod keeps bump steer small (inner end on the inner-pivot line, outer on the ball-joint line)', () => {
    const toe = sweepTravel(FRONT_HARDPOINTS, 0.06, 12).map((s) => Math.abs(s.toeDeg))
    expect(Math.max(...toe)).toBeLessThan(0.01)
  })

  it('the default rear toe link keeps bump steer small', () => {
    expect(Math.max(...sweepTravel(REAR_HARDPOINTS, 0.06, 12).map((s) => Math.abs(s.toeDeg)))).toBeLessThan(0.03)
  })

  it('is reproducible: identical inputs give identical outputs', () => {
    expect(sweepTravel(FRONT_HARDPOINTS, 0.05, 8)).toEqual(sweepTravel(FRONT_HARDPOINTS, 0.05, 8))
  })

  it('steering the rack changes toe in opposite senses for opposite rack directions', () => {
    const plus = solveCorner(FRONT_HARDPOINTS, 0, 0.01)!, minus = solveCorner(FRONT_HARDPOINTS, 0, -0.01)!
    expect(Math.sign(plus.toeDeg)).toBe(-Math.sign(minus.toeDeg))
    expect(Math.abs(plus.toeDeg)).toBeGreaterThan(0.5)
  })

  it('solves the five-link rear and reports a finite roll centre and motion ratio', () => {
    expect(sweepTravel(REAR_HARDPOINTS, 0.06, 8).every((s) => s.residual < 1e-9)).toBe(true)
    const summary = summarise(REAR_HARDPOINTS, 'ILLUSTRATIVE', { springRate: unknown('N/mm'), rockerRatio: unknown('ratio'), damperCoefficient: unknown('N·s/m'), cornerMass: unknown('kg') })
    expect(Number.isFinite(summary.rollCentre.value!)).toBe(true)
    expect(summary.motionRatio.value).toBeGreaterThan(0)
  })
})

describe('spring and damper rates', () => {
  const src = (value: number, unit: string) => quantity(value, unit, 'SOURCED', { source: 'test' })
  it('needs every input, then gives wheel rate = k·IR², ride frequency and damping ratio', () => {
    const none = summarise(FRONT_HARDPOINTS, 'SOURCED', { springRate: unknown('N/mm'), rockerRatio: unknown('ratio'), damperCoefficient: unknown('N·s/m'), cornerMass: unknown('kg') })
    expect(none.wheelRate).toMatchObject({ value: null, missing: ['rockerRatio', 'springRate'] })
    const s = summarise(FRONT_HARDPOINTS, 'SOURCED', { springRate: src(100, 'N/mm'), rockerRatio: src(1.5, 'ratio'), damperCoefficient: src(3000, 'N·s/m'), cornerMass: src(150, 'kg') })
    const ir = s.motionRatio.value! * 1.5
    expect(s.installationRatio.value).toBeCloseTo(ir)
    expect(s.wheelRate.value).toBeCloseTo(100 * ir * ir)
    expect(s.rideFrequency.value).toBeCloseTo(Math.sqrt(100 * ir * ir * 1000 / 150) / (2 * Math.PI))
    expect(s.dampingRatio.value).toBeCloseTo(3000 * ir * ir / (2 * Math.sqrt(100 * ir * ir * 1000 * 150)))
    expect(s.wheelRate.provenance).toBe('DERIVED')
  })
  it('inherits ILLUSTRATIVE from the default hardpoints', () => {
    const s = summarise(FRONT_HARDPOINTS, 'ILLUSTRATIVE', { springRate: src(100, 'N/mm'), rockerRatio: src(1, 'ratio'), damperCoefficient: unknown('N·s/m'), cornerMass: unknown('kg') })
    expect(s.wheelRate.provenance).toBe('ILLUSTRATIVE')
  })
})

describe('hardpoints drive the 3D suspension', () => {
  it('each wishbone is two legs meeting at one outboard ball joint, and the right side mirrors the left', () => {
    const segs = (id: string) => parts.find((p) => p.id === id)!.segments!
    for (const id of ['upper-wishbone', 'lower-wishbone']) expect(segs(id)[0][1]).toEqual(segs(id)[1][1])
    expect(segs('front-right-upper-wishbone')[0][1]).toEqual(mirror(segs('upper-wishbone')[0][1]))
    expect(parts.find((p) => p.id === 'rear-right-toe-link')).toBeDefined()
  })
})
