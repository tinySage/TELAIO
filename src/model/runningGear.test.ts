import { describe, expect, it } from 'vitest'
import { parts } from './components'
import { dependencies, getInstallationBlockers, getRemovalBlockers, getRemovalSequence, installPrerequisites, interfaces, validateAssemblyModel, validateInstalledSet } from './assembly'

const allIds = parts.map((part) => part.id)
const byId = (id: string) => {
  const part = parts.find((item) => item.id === id)
  if (!part) throw new Error('missing ' + id)
  return part
}

const corners = [
  { name: 'front-left', disc: 'brake-disc', caliper: 'brake-caliper', hub: 'front-hub', wheel: 'wheel-tyre', upright: 'front-upright', pads: ['pad-inner', 'pad-outer'] },
  { name: 'front-right', disc: 'front-right-brake-disc', caliper: 'front-right-brake-caliper', hub: 'front-right-hub', wheel: 'front-right-wheel', upright: 'front-right-upright', pads: ['front-right-pad-inner', 'front-right-pad-outer'] },
  { name: 'rear-left', disc: 'rear-left-brake-disc', caliper: 'rear-left-brake-caliper', hub: 'rear-left-hub', wheel: 'rear-left-wheel', upright: 'rear-upright', pads: ['rear-left-pad-inner', 'rear-left-pad-outer'] },
  { name: 'rear-right', disc: 'rear-right-brake-disc', caliper: 'rear-right-brake-caliper', hub: 'rear-right-hub', wheel: 'rear-right-wheel', upright: 'rear-right-upright', pads: ['rear-right-pad-inner', 'rear-right-pad-outer'] },
]

describe('Phase 10 running gear', () => {
  it('has unique component IDs and a consistent relation model', () => {
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(validateAssemblyModel()).toEqual([])
    expect(validateInstalledSet(allIds)).toEqual([])
  })

  it('gives every component illustrative provenance, unestablished dimensions and an install rule', () => {
    for (const part of parts) {
      expect(part.provenance, part.id).toBe('ILLUSTRATIVE')
      expect(part.dimensions, part.id).toBe('Not established')
      expect(installPrerequisites[part.id], part.id).toBeDefined()
    }
  })

  it('connects every component to the assembly through at least one interface', () => {
    for (const id of allIds) expect(interfaces.some((edge) => edge.ownerId === id || edge.targetId === id), id).toBe(true)
  })

  it('places each wheel on its own axle line, coaxial with its hub and disc', () => {
    for (const corner of corners) {
      const [wheel, hub, disc] = [byId(corner.wheel), byId(corner.hub), byId(corner.disc)]
      for (const part of [hub, disc]) {
        expect(part.position[0], part.id).toBeCloseTo(wheel.position[0])
        expect(part.position[1], part.id).toBeCloseTo(wheel.position[1])
        expect(Math.sign(part.position[2]), part.id).toBe(Math.sign(wheel.position[2]))
        expect(Math.abs(part.position[2]), part.id).toBeLessThan(Math.abs(wheel.position[2]))
      }
    }
  })

  it('mirrors the right-hand corners exactly across the centre plane', () => {
    const pairs = [['brake-caliper', 'front-right-brake-caliper'], ['front-upright', 'front-right-upright'], ['rear-left-brake-caliper', 'rear-right-brake-caliper'], ['rear-upright', 'rear-right-upright'], ['tie-rod-left', 'tie-rod-right'], ['front-damper-left', 'front-damper-right']]
    for (const [left, right] of pairs) {
      const [l, r] = [byId(left), byId(right)]
      const mirrored = (a: number[], b: number[]) => a.forEach((value, axis) => expect(b[axis], left + ' axis ' + axis).toBeCloseTo(axis === 2 ? -value : value))
      mirrored(l.position, r.position)
      l.segments?.forEach(([from, to], index) => {
        mirrored(from, r.segments![index][0])
        mirrored(to, r.segments![index][1])
      })
    }
  })

  for (const corner of corners) {
    it(`services and rebuilds the ${corner.name} brake corner`, () => {
      const sequence = getRemovalSequence(corner.disc, allIds)
      expect(sequence[0], 'wheel first').toBe(corner.wheel)
      expect(sequence).toContain(corner.caliper)
      for (const pad of corner.pads) expect(sequence.indexOf(pad)).toBeLessThan(sequence.indexOf(corner.caliper))
      // Servicing one corner never touches another.
      const others = corners.filter((item) => item !== corner).flatMap((item) => [item.disc, item.caliper, item.wheel, ...item.pads])
      expect(sequence.filter((id) => others.includes(id))).toEqual([])

      let installed = [...allIds]
      for (const id of [...sequence, corner.disc]) {
        expect(getRemovalBlockers(id, installed), 'removing ' + id).toEqual([])
        installed = installed.filter((item) => item !== id)
      }
      expect(validateInstalledSet(installed)).toEqual([])
      for (const id of [corner.disc, ...[...sequence].reverse()]) {
        expect(getInstallationBlockers(id, installed), 'installing ' + id).toEqual([])
        installed = [...installed, id]
      }
      expect([...installed].sort()).toEqual([...allIds].sort())
    })
  }

  it('routes push-rods and pull-rods to rockers, and blocks a rocker while its rod is fitted', () => {
    for (const [rod, rocker] of [['push-rod', 'front-rocker-left'], ['front-right-push-rod', 'front-rocker-right'], ['rear-pull-rod', 'rear-rocker-left'], ['rear-right-pull-rod', 'rear-rocker-right']]) {
      expect(interfaces.some((edge) => edge.ownerId === rod && edge.targetId === rocker), rod).toBe(true)
      expect(getRemovalBlockers(rocker, allIds), rocker).toContain(rod)
    }
  })

  it('steers both front uprights from one rack', () => {
    expect(getRemovalBlockers('steering-rack', allIds).sort()).toEqual(['steering-column', 'tie-rod-left', 'tie-rod-right'])
    expect(dependencies['tie-rod-right']).toContain('front-right-upright')
  })

  it('splits brake hydraulics into front and rear circuits', () => {
    const circuit = (mc: string) => interfaces.filter((edge) => edge.ownerId === mc && edge.label.includes('hydraulic')).map((edge) => edge.targetId).sort()
    expect(circuit('master-cylinder-front')).toEqual(['brake-caliper', 'front-right-brake-caliper'])
    expect(circuit('master-cylinder-rear')).toEqual(['rear-left-brake-caliper', 'rear-right-brake-caliper'])
  })
})
