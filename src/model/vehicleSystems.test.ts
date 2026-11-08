import { describe, expect, it } from 'vitest'
import { parts } from './components'
import { getInstallationBlockers, getRemovalBlockers, getRemovalSequence, interfaces, validateInstalledSet } from './assembly'

const allIds = parts.map((part) => part.id)
const linked = (owner: string, target: string) => interfaces.some((edge) => edge.ownerId === owner && edge.targetId === target)

describe('Phase 10 chassis, powertrain, cooling and aero', () => {
  it('stacks the power unit as a stressed member: survival cell → engine → gearbox → differential', () => {
    expect(getInstallationBlockers('engine', ['chassis-node'])).toEqual([])
    expect(getInstallationBlockers('gearbox', ['chassis-node'])).toEqual(['engine'])
    expect(getInstallationBlockers('differential', ['chassis-node', 'engine'])).toEqual(['gearbox'])
    expect(linked('gearbox', 'engine') && linked('differential', 'gearbox')).toBe(true)
  })

  it('carries the rear wing on the gearbox, so the gearbox cannot come off under it', () => {
    expect(linked('rear-wing-reference', 'gearbox')).toBe(true)
    expect(getRemovalBlockers('gearbox', allIds)).toContain('rear-wing-reference')
  })

  it('drives both rear hubs through driveshafts from the differential', () => {
    for (const [shaft, hub] of [['driveshaft-left', 'rear-left-hub'], ['driveshaft-right', 'rear-right-hub']]) {
      expect(linked(shaft, 'differential') && linked(shaft, hub), shaft).toBe(true)
      expect(getRemovalBlockers(hub, allIds), hub).toContain(shaft)
    }
  })

  it('removes the sidepod bodywork before the radiator it encloses', () => {
    expect(getRemovalBlockers('radiator-left', allIds)).toEqual(['sidepod-left'])
    expect(linked('sidepod-left', 'radiator-left') && linked('radiator-left', 'engine')).toBe(true)
  })

  it('mounts the nose on the front bulkhead and the diffuser on the floor', () => {
    expect(getInstallationBlockers('nose-reference', ['chassis-node'])).toEqual(['front-bulkhead'])
    expect(getRemovalBlockers('floor-reference', allIds)).toEqual(['diffuser'])
  })

  it('tears the whole vehicle down to the bare survival cell in a valid order, then rebuilds it', () => {
    const sequence = getRemovalSequence('chassis-node', allIds)
    expect([...sequence, 'chassis-node'].sort()).toEqual([...allIds].sort())
    let installed = [...allIds]
    for (const id of sequence) {
      expect(getRemovalBlockers(id, installed), 'removing ' + id).toEqual([])
      installed = installed.filter((item) => item !== id)
      expect(validateInstalledSet(installed)).toEqual([])
    }
    expect(installed).toEqual(['chassis-node'])
    for (const id of [...sequence].reverse()) {
      expect(getInstallationBlockers(id, installed), 'installing ' + id).toEqual([])
      installed = [...installed, id]
    }
    expect([...installed].sort()).toEqual([...allIds].sort())
  })
})
