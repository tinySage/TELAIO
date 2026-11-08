import { describe, expect, it } from 'vitest'
import { parts } from './components'
import { getInstallationBlockers, getRemovalBlockers, getRemovalSequence, installPrerequisites, interfaces, validateAssemblyModel, validateInstalledSet } from './assembly'

const allIds = parts.map((part) => part.id)
const brakeCorner = ['front-hub', 'brake-disc', 'caliper-mount', 'brake-caliper', 'pad-inner-backing', 'pad-outer-backing', 'pad-inner', 'pad-outer']

function remove(id: string, installed: string[]): string[] {
  expect(getRemovalBlockers(id, installed), 'removing ' + id).toEqual([])
  return installed.filter((item) => item !== id)
}
function install(id: string, installed: string[]): string[] {
  expect(getInstallationBlockers(id, installed), 'installing ' + id).toEqual([])
  return [...installed, id]
}

describe('Phase 9 brake assembly model', () => {
  it('has no dangling interface or dependency references', () => {
    expect(validateAssemblyModel()).toEqual([])
  })

  it('defines every brake corner component with illustrative provenance and install rules', () => {
    for (const id of brakeCorner) {
      const part = parts.find((item) => item.id === id)
      expect(part, id).toBeDefined()
      expect(part?.provenance).toBe('ILLUSTRATIVE')
      expect(part?.dimensions).toBe('Not established')
      expect(installPrerequisites[id], id).toBeDefined()
    }
  })

  it('gives every brake component at least one interface record', () => {
    for (const id of brakeCorner) expect(interfaces.some((edge) => edge.ownerId === id || edge.targetId === id), id).toBe(true)
  })

  it('has acyclic prerequisites, so the full vehicle can be built from nothing', () => {
    let installed: string[] = []
    let remaining = [...allIds]
    while (remaining.length) {
      const ready = remaining.filter((id) => getInstallationBlockers(id, installed).length === 0)
      expect(ready.length, 'stuck with ' + remaining.join(', ')).toBeGreaterThan(0)
      installed = [...installed, ...ready]
      remaining = remaining.filter((id) => !ready.includes(id))
    }
    expect(validateInstalledSet(installed)).toEqual([])
  })

  it('blocks removing the rotor while the caliper, pads or wheel are installed', () => {
    expect(getRemovalBlockers('brake-disc', allIds).sort()).toEqual(['brake-caliper', 'wheel-tyre'].sort())
    expect(getRemovalBlockers('brake-caliper', allIds).sort()).toEqual(['pad-inner-backing', 'pad-outer-backing', 'wheel-tyre'].sort())
    expect(getRemovalBlockers('pad-inner-backing', allIds)).toEqual(['pad-inner'])
  })

  it('removes pads and caliper in a valid order, isolates the rotor, and rebuilds', () => {
    const sequence = getRemovalSequence('brake-disc', allIds)
    expect(sequence[0]).toBe('wheel-tyre')
    expect(sequence.indexOf('pad-inner')).toBeLessThan(sequence.indexOf('pad-inner-backing'))
    expect(sequence.indexOf('pad-outer')).toBeLessThan(sequence.indexOf('pad-outer-backing'))
    expect(sequence.indexOf('pad-inner-backing')).toBeLessThan(sequence.indexOf('brake-caliper'))
    expect(sequence.indexOf('wheel-tyre')).toBeLessThan(sequence.indexOf('brake-caliper'))

    let installed = [...allIds]
    for (const id of sequence) installed = remove(id, installed)
    expect(validateInstalledSet(installed)).toEqual([])
    expect(getRemovalBlockers('brake-disc', installed)).toEqual([])

    for (const id of [...sequence].reverse()) installed = install(id, installed)
    expect([...installed].sort()).toEqual([...allIds].sort())
    expect(validateInstalledSet(installed)).toEqual([])
  })

  it('refuses invalid installs: caliper before rotor, lining before backing plate', () => {
    const withoutBrakes = allIds.filter((id) => !['brake-disc', 'brake-caliper', 'pad-inner', 'pad-outer', 'pad-inner-backing', 'pad-outer-backing', 'wheel-tyre'].includes(id))
    expect(getInstallationBlockers('brake-caliper', withoutBrakes)).toEqual(['brake-disc'])
    expect(getInstallationBlockers('pad-inner', [...withoutBrakes, 'brake-disc', 'brake-caliper'])).toEqual(['pad-inner-backing'])
  })
})
