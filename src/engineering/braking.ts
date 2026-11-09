/**
 * Braking laboratory: straight-line braking with longitudinal load transfer, fixed front/rear brake
 * bias and a single tyre-road friction coefficient. SI units throughout. Two models:
 *
 *  - Constant: no aerodynamic forces, so achievable deceleration is constant and closed-form.
 *  - Aero: downforce and drag vary with speed; deceleration is solved at each speed and distance is
 *    integrated (dx = v dv / a). With zero aero coefficients it reproduces the constant model.
 *
 * The aero model is used only when all aero inputs are established; otherwise the constant model runs
 * and says so in its assumptions. No tyre load sensitivity, no ABS, no brake fade, no pitch dynamics.
 */
import { gather, isKnown, result, type Provenance, type Quantity, type Result } from './quantity'

export const G = 9.80665
export const BRAKING_MODEL = { id: 'telaio.braking', version: '1.0.0' } as const

export type BrakingInputs = {
  mass: Quantity; wheelbase: Quantity; frontWeightFraction: Quantity; cogHeight: Quantity
  mu: Quantity; brakeBias: Quantity; tyreRadius: Quantity
  speed: Quantity; reactionTime: Quantity
  rotorMass: Quantity; rotorSpecificHeat: Quantity; rotorEnergyShare: Quantity
  clA: Quantity; cdA: Quantity; airDensity: Quantity; aeroBalance: Quantity
}

export const BRAKING_INPUT_SPECS: { key: keyof BrakingInputs; label: string; unit: string; group: string }[] = [
  { key: 'mass', label: 'Vehicle mass', unit: 'kg', group: 'Vehicle' },
  { key: 'frontWeightFraction', label: 'Static front weight fraction', unit: 'fraction', group: 'Vehicle' },
  { key: 'cogHeight', label: 'CoG height', unit: 'm', group: 'Vehicle' },
  { key: 'wheelbase', label: 'Wheelbase', unit: 'm', group: 'Vehicle' },
  { key: 'mu', label: 'Tyre-road friction μ', unit: '–', group: 'Tyre' },
  { key: 'tyreRadius', label: 'Tyre rolling radius', unit: 'm', group: 'Tyre' },
  { key: 'brakeBias', label: 'Brake bias (front share)', unit: 'fraction', group: 'Brakes' },
  { key: 'rotorMass', label: 'Front rotor mass (each)', unit: 'kg', group: 'Brakes' },
  { key: 'rotorSpecificHeat', label: 'Rotor specific heat', unit: 'J/(kg·K)', group: 'Brakes' },
  { key: 'rotorEnergyShare', label: 'Share of front-axle energy into rotors', unit: 'fraction', group: 'Brakes' },
  { key: 'clA', label: 'Downforce coefficient × area ClA', unit: 'm²', group: 'Aero (optional)' },
  { key: 'cdA', label: 'Drag coefficient × area CdA', unit: 'm²', group: 'Aero (optional)' },
  { key: 'airDensity', label: 'Air density ρ', unit: 'kg/m³', group: 'Aero (optional)' },
  { key: 'aeroBalance', label: 'Aero balance (front share of downforce)', unit: 'fraction', group: 'Aero (optional)' },
  { key: 'speed', label: 'Initial speed', unit: 'km/h', group: 'Scenario' },
  { key: 'reactionTime', label: 'Driver/system reaction time', unit: 's', group: 'Scenario' },
]

export const emptyBrakingInputs = (): BrakingInputs => Object.fromEntries(BRAKING_INPUT_SPECS.map((s) => [s.key, { value: null, unit: s.unit, provenance: 'UNKNOWN' }])) as unknown as BrakingInputs

type Core = { m: number; L: number; f: number; h: number; mu: number; beta: number }
type Aero = { clA: number; cdA: number; rho: number; balance: number } | null

/** Brake force limits at speed v (m/s): the force at which each axle reaches μ, given the bias. */
export function brakeForceLimits(c: Core, aero: Aero, v: number) {
  const q = aero ? 0.5 * aero.rho * v * v : 0
  const downforce = aero ? q * aero.clA : 0, drag = aero ? q * aero.cdA : 0
  const df = aero ? downforce * aero.balance : 0, dr = downforce - df
  const k = c.mu * c.h / c.L
  // Front: β·Fb = μ(m g f + Df + (Fb + Fd) h / L); Rear: (1−β)·Fb = μ(m g (1−f) + Dr − (Fb + Fd) h / L)
  const front = c.beta - k > 1e-12 ? c.mu * (c.m * G * c.f + df + drag * c.h / c.L) / (c.beta - k) : Infinity
  const rear = c.mu * (c.m * G * (1 - c.f) + dr - drag * c.h / c.L) / ((1 - c.beta) + k)
  const brakeForce = Math.min(front, rear)
  return { brakeForce, drag, downforce, limitingAxle: front <= rear ? 'front' as const : 'rear' as const, decel: (brakeForce + drag) / c.m }
}

/** Ideal (equal-utilisation) front bias at deceleration z (in g), no aero. */
export const idealBias = (c: Pick<Core, 'f' | 'h' | 'L'>, z: number) => c.f + z * c.h / c.L

/** Distance to stop from v0 (m/s), integrating dx = v dv / a(v). */
export function brakingDistance(c: Core, aero: Aero, v0: number, steps = 4000): number {
  if (!aero) return v0 * v0 / (2 * brakeForceLimits(c, null, v0).decel)
  let distance = 0
  for (let i = 0; i < steps; i++) {
    const v1 = v0 * (1 - i / steps), v2 = v0 * (1 - (i + 1) / steps)
    const g1 = v1 / brakeForceLimits(c, aero, v1).decel, g2 = v2 / brakeForceLimits(c, aero, v2).decel
    distance += 0.5 * (g1 + g2) * (v1 - v2)
  }
  return distance
}

export type BrakingReport = {
  model: 'constant' | 'aero'
  decelG: Result<number>; limitingAxle: 'front' | 'rear' | null
  idealBiasAtLimit: Result<number>
  loadTransfer: Result<number>; frontLoad: Result<number>; rearLoad: Result<number>
  brakingDistance: Result<number>; stoppingDistance: Result<number>; stopTime: Result<number>
  frontTorquePerWheel: Result<number>; rearTorquePerWheel: Result<number>; peakFrontPower: Result<number>
  rotorTemperatureRise: Result<number>
}

const coreKeys = ['mass', 'wheelbase', 'frontWeightFraction', 'cogHeight', 'mu', 'brakeBias'] as const

export function analyseBraking(inputs: BrakingInputs): BrakingReport {
  const core = gather(Object.fromEntries(coreKeys.map((k) => [k, inputs[k]])) as Record<(typeof coreKeys)[number], Quantity>)
  const aeroGathered = gather({ clA: inputs.clA, cdA: inputs.cdA, airDensity: inputs.airDensity, aeroBalance: inputs.aeroBalance })
  const useAero = aeroGathered.missing.length === 0
  const baseAssumptions = ['Straight-line braking on level ground; single friction coefficient for all tyres; no tyre load sensitivity, ABS, fade or pitch dynamics', 'Longitudinal load transfer = m·a·h / L with drag acting at CoG height']
  const assumptions = [...baseAssumptions, useAero ? 'Aero model: downforce and drag ∝ v², split by aero balance; distance integrated over speed' : 'Constant model: aerodynamic forces ignored (aero inputs not all established)']
  const coreProv: Provenance[] = [...core.provenances, ...(useAero ? aeroGathered.provenances : [])]
  const validCore = core.missing.length === 0 && core.values.mass > 0 && core.values.wheelbase > 0 && core.values.mu > 0 && core.values.brakeBias > 0 && core.values.brakeBias < 1 && core.values.frontWeightFraction > 0 && core.values.frontWeightFraction < 1 && core.values.cogHeight >= 0
  const c: Core | null = validCore ? { m: core.values.mass, L: core.values.wheelbase, f: core.values.frontWeightFraction, h: core.values.cogHeight, mu: core.values.mu, beta: core.values.brakeBias } : null
  const aero: Aero = useAero ? { clA: aeroGathered.values.clA, cdA: aeroGathered.values.cdA, rho: aeroGathered.values.airDensity, balance: aeroGathered.values.aeroBalance } : null
  const coreMissing = validCore ? [] : core.missing.length ? core.missing : ['valid ranges (0 < bias, front fraction < 1; μ, mass, wheelbase > 0)']
  const speedKnown = isKnown(inputs.speed) && inputs.speed.value > 0
  const v0 = speedKnown ? inputs.speed.value! / 3.6 : 0
  const atStart = c ? brakeForceLimits(c, aero, v0) : null
  const z = atStart ? atStart.decel / G : null

  const r = <T,>(value: T | null, unit: string, extra: Quantity[] = [], missing: string[] = [], more: string[] = []) =>
    result(value, unit, [...coreProv, ...extra.map((q) => q.provenance)], [...coreMissing, ...missing], [...assumptions, ...more])
  const need = (q: Quantity, key: string) => isKnown(q) ? [] : [key]

  const distance = c && speedKnown ? brakingDistance(c, aero, v0) : null
  const speedMissing = need(inputs.speed, 'speed')
  const avgDecel = distance ? v0 * v0 / (2 * distance) : null
  const transfer = c && z !== null ? c.m * G * z * c.h / c.L : null
  const radiusKnown = isKnown(inputs.tyreRadius)
  const rotorInputs = gather({ rotorMass: inputs.rotorMass, rotorSpecificHeat: inputs.rotorSpecificHeat, rotorEnergyShare: inputs.rotorEnergyShare })
  const kinetic = c && speedKnown ? 0.5 * c.m * v0 * v0 : null
  // Energy through the front brakes ≈ bias × brake work; brake work = KE − drag work. Drag work from the integration.
  const brakeWork = c && speedKnown && kinetic !== null ? (aero ? kinetic - dragWork(c, aero, v0) : kinetic) : null
  const rotorRise = brakeWork !== null && c && rotorInputs.missing.length === 0 && rotorInputs.values.rotorMass > 0
    ? c.beta * brakeWork * rotorInputs.values.rotorEnergyShare / 2 / (rotorInputs.values.rotorMass * rotorInputs.values.rotorSpecificHeat) : null

  return {
    model: aero ? 'aero' : 'constant',
    decelG: r(z, 'g', speedKnown || !aero ? [] : [inputs.speed], aero ? speedMissing : [], aero ? ['Peak deceleration at the initial speed'] : []),
    limitingAxle: atStart?.limitingAxle ?? null,
    idealBiasAtLimit: r(c && z !== null && !aero ? idealBias(c, z) : null, 'fraction', [], aero ? ['ideal bias is speed-dependent with aero; see the bias sweep'] : []),
    loadTransfer: r(transfer, 'N', aero ? [inputs.speed] : [], aero ? speedMissing : []),
    frontLoad: r(c && z !== null && atStart ? c.m * G * c.f + (aero ? atStart.downforce * aero.balance : 0) + (atStart.brakeForce + atStart.drag) * c.h / c.L : null, 'N', aero ? [inputs.speed] : [], aero ? speedMissing : []),
    rearLoad: r(c && z !== null && atStart ? c.m * G * (1 - c.f) + (aero ? atStart.downforce * (1 - aero.balance) : 0) - (atStart.brakeForce + atStart.drag) * c.h / c.L : null, 'N', aero ? [inputs.speed] : [], aero ? speedMissing : []),
    brakingDistance: r(distance, 'm', [inputs.speed], speedMissing),
    stoppingDistance: r(distance !== null && isKnown(inputs.reactionTime) ? distance + v0 * inputs.reactionTime.value : null, 'm', [inputs.speed, inputs.reactionTime], [...speedMissing, ...need(inputs.reactionTime, 'reactionTime')], ['Speed constant during the reaction time']),
    stopTime: r(avgDecel ? (aero ? stopTimeIntegrated(c!, aero, v0) : v0 / avgDecel) : null, 's', [inputs.speed], speedMissing),
    frontTorquePerWheel: r(atStart && radiusKnown ? atStart.brakeForce * c!.beta / 2 * inputs.tyreRadius.value! : null, 'N·m', [inputs.tyreRadius, ...(aero ? [inputs.speed] : [])], [...need(inputs.tyreRadius, 'tyreRadius'), ...(aero ? speedMissing : [])], ['Peak torque at the initial speed, equal split left/right']),
    rearTorquePerWheel: r(atStart && radiusKnown ? atStart.brakeForce * (1 - c!.beta) / 2 * inputs.tyreRadius.value! : null, 'N·m', [inputs.tyreRadius, ...(aero ? [inputs.speed] : [])], [...need(inputs.tyreRadius, 'tyreRadius'), ...(aero ? speedMissing : [])]),
    peakFrontPower: r(atStart && speedKnown ? atStart.brakeForce * c!.beta * v0 : null, 'W', [inputs.speed], speedMissing),
    rotorTemperatureRise: r(rotorRise, 'K', [inputs.speed, inputs.rotorMass, inputs.rotorSpecificHeat, inputs.rotorEnergyShare], [...speedMissing, ...rotorInputs.missing],
      ['Single stop, lumped rotor temperature; no convection, radiation or conduction during the stop; front energy = bias × brake work, split equally between front rotors']),
  }
}

function dragWork(c: Core, aero: NonNullable<Aero>, v0: number, steps = 4000): number {
  let work = 0
  for (let i = 0; i < steps; i++) {
    const v1 = v0 * (1 - i / steps), v2 = v0 * (1 - (i + 1) / steps)
    const w = (v: number) => { const s = brakeForceLimits(c, aero, v); return s.drag * v / s.decel }
    work += 0.5 * (w(v1) + w(v2)) * (v1 - v2)
  }
  return work
}

function stopTimeIntegrated(c: Core, aero: NonNullable<Aero>, v0: number, steps = 4000): number {
  let t = 0
  for (let i = 0; i < steps; i++) {
    const v1 = v0 * (1 - i / steps), v2 = v0 * (1 - (i + 1) / steps)
    t += 0.5 * (1 / brakeForceLimits(c, aero, v1).decel + 1 / brakeForceLimits(c, aero, v2).decel) * (v1 - v2)
  }
  return t
}

/** Achievable deceleration (g) at the initial speed across a range of bias values. */
export function biasSweep(inputs: BrakingInputs, from = 0.4, to = 0.8, steps = 41): { bias: number[]; decel: (number | null)[]; ideal: number | null } {
  const bias = Array.from({ length: steps }, (_, i) => from + (to - from) * i / (steps - 1))
  const decel = bias.map((b) => analyseBraking({ ...inputs, brakeBias: { ...inputs.brakeBias, value: b, provenance: inputs.brakeBias.provenance === 'UNKNOWN' ? 'ILLUSTRATIVE' : inputs.brakeBias.provenance } }).decelG.value)
  const known = decel.filter((d): d is number => d !== null)
  const ideal = known.length ? bias[decel.indexOf(Math.max(...known))] : null
  return { bias, decel, ideal }
}

/** Braking distance across initial speeds. */
export function speedSweep(inputs: BrakingInputs, maxKmh = 300, steps = 31): { speed: number[]; distance: (number | null)[] } {
  const speed = Array.from({ length: steps }, (_, i) => maxKmh * (i + 1) / steps)
  return { speed, distance: speed.map((v) => analyseBraking({ ...inputs, speed: { ...inputs.speed, value: v, provenance: 'DERIVED' } }).brakingDistance.value) }
}

/** Normalised sensitivity of braking distance: (∂d/d)/(∂x/x) by ±1 % central differences. */
export function distanceSensitivity(inputs: BrakingInputs): { key: keyof BrakingInputs; label: string; elasticity: number }[] {
  const base = analyseBraking(inputs).brakingDistance.value
  if (base === null) return []
  return BRAKING_INPUT_SPECS.filter((spec) => isKnown(inputs[spec.key]) && inputs[spec.key].value !== 0).flatMap((spec) => {
    const q = inputs[spec.key], x = q.value!
    const at = (k: number) => analyseBraking({ ...inputs, [spec.key]: { ...q, value: x * k } }).brakingDistance.value
    const up = at(1.01), down = at(0.99)
    if (up === null || down === null) return []
    const elasticity = ((up - down) / base) / 0.02
    return Math.abs(elasticity) < 1e-9 ? [] : [{ key: spec.key, label: spec.label, elasticity }]
  }).sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
}

export type StudyRecord = {
  model: typeof BRAKING_MODEL
  name: string
  createdAt: string
  inputs: BrakingInputs
  outputs: Record<string, { value: number | null; provenance: Provenance }>
}

const outputValues = (report: BrakingReport): StudyRecord['outputs'] => Object.fromEntries(Object.entries(report)
  .filter(([, v]) => v && typeof v === 'object' && 'provenance' in v)
  .map(([k, v]) => [k, { value: (v as Result<number>).value, provenance: (v as Result<number>).provenance }]))

export function createStudy(name: string, inputs: BrakingInputs, createdAt = new Date().toISOString()): StudyRecord {
  return { model: BRAKING_MODEL, name, createdAt, inputs: structuredClone(inputs), outputs: outputValues(analyseBraking(inputs)) }
}

/** Re-runs a stored study and lists any outputs that differ from the record. */
export function reproduceStudy(record: StudyRecord): { reproducible: boolean; differences: string[]; modelMatches: boolean } {
  const modelMatches = record.model?.id === BRAKING_MODEL.id && record.model?.version === BRAKING_MODEL.version
  const now = outputValues(analyseBraking(record.inputs))
  const differences = Object.keys({ ...now, ...record.outputs }).filter((key) => {
    const a = record.outputs[key], b = now[key]
    if (!a || !b) return true
    if (a.provenance !== b.provenance) return true
    if (a.value === null || b.value === null) return a.value !== b.value
    return Math.abs(a.value - b.value) > 1e-9 * Math.max(1, Math.abs(a.value))
  })
  return { reproducible: modelMatches && differences.length === 0, differences, modelMatches }
}

/** Generic single-seater textbook values for exploring the lab: ILLUSTRATIVE, not SF-24 data. */
export function illustrativeBrakingInputs(): BrakingInputs {
  const note = 'Generic textbook-order value for exploring the lab; not SF-24 or any real car data'
  const q = (value: number, unit: string): Quantity => ({ value, unit, provenance: 'ILLUSTRATIVE', note })
  return {
    mass: q(800, 'kg'), wheelbase: q(3.6, 'm'), frontWeightFraction: q(0.45, 'fraction'), cogHeight: q(0.3, 'm'),
    mu: q(1.6, '–'), brakeBias: q(0.56, 'fraction'), tyreRadius: q(0.36, 'm'),
    speed: q(300, 'km/h'), reactionTime: q(0.2, 's'),
    rotorMass: q(1.2, 'kg'), rotorSpecificHeat: q(800, 'J/(kg·K)'), rotorEnergyShare: q(0.8, 'fraction'),
    clA: q(4, 'm²'), cdA: q(1.2, 'm²'), airDensity: q(1.2, 'kg/m³'), aeroBalance: q(0.42, 'fraction'),
  }
}
