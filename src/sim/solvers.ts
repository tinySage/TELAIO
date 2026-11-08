/**
 * Solver registry: every simulation TELAIO can run, as a pure function from a JSON-serialisable input
 * to a JSON-serialisable output, with an id and version. The same functions run in the worker, in
 * tests and when verifying a package, so a re-run is the same code path as the original run.
 */
import { analyseBraking, biasSweep, BRAKING_MODEL, distanceSensitivity, speedSweep, type BrakingInputs } from '../engineering/braking'
import { analyseDynamics, coreOf, DYNAMICS_MODEL, parameterSweep, type Track, type VehicleConfig } from '../engineering/dynamics'
import { summarise, sweepTravel, type SpringDamperInputs } from '../engineering/suspension'
import type { CornerHardpoints } from '../model/hardpoints'
import type { Provenance } from '../engineering/quantity'

export type SolverId = 'braking-study' | 'lap-simulation' | 'lap-parameter-sweep' | 'suspension-sweep'
export type SolverInputs = {
  'braking-study': { inputs: BrakingInputs }
  'lap-simulation': { vehicle: VehicleConfig; track: Track; handlingSpeedKmh: number }
  'lap-parameter-sweep': { vehicle: VehicleConfig; track: Track; parameter: Exclude<keyof VehicleConfig, 'name'>; from: number; to: number; steps: number }
  'suspension-sweep': { hardpoints: CornerHardpoints; provenance: Provenance; springs: SpringDamperInputs; range: number; steps: number }
}

export type SolverOutput = { summary: Record<string, { value: number | string | null; unit: string; provenance: Provenance }>; series: Record<string, (number | null)[]>; assumptions: string[]; missing: string[] }

export type Solver<K extends SolverId> = { id: K; version: string; label: string; description: string; run: (input: SolverInputs[K], progress?: (fraction: number) => void) => SolverOutput }

const pick = (label: string, r: { value: number | null; unit: string; provenance: Provenance }) => [label, { value: r.value, unit: r.unit, provenance: r.provenance }] as const
const uniq = (xs: string[]) => [...new Set(xs)]

export const SOLVERS: { [K in SolverId]: Solver<K> } = {
  'braking-study': {
    id: 'braking-study', version: BRAKING_MODEL.version, label: 'Braking study', description: 'Straight-line braking (Phase 14 model) with bias and speed sweeps and sensitivity',
    run: ({ inputs }, progress) => {
      const r = analyseBraking(inputs); progress?.(0.4)
      const bias = biasSweep(inputs); progress?.(0.7)
      const speeds = speedSweep(inputs); progress?.(0.9)
      const sensitivity = distanceSensitivity(inputs)
      const results = [r.decelG, r.brakingDistance, r.stoppingDistance, r.stopTime, r.loadTransfer, r.frontTorquePerWheel, r.rearTorquePerWheel, r.peakFrontPower, r.rotorTemperatureRise]
      return {
        summary: Object.fromEntries([pick('Deceleration', r.decelG), pick('Braking distance', r.brakingDistance), pick('Stopping distance', r.stoppingDistance), pick('Time to stop', r.stopTime),
          pick('Load transfer', r.loadTransfer), pick('Front torque per wheel', r.frontTorquePerWheel), pick('Peak front power', r.peakFrontPower), pick('Rotor temperature rise', r.rotorTemperatureRise),
          ['Model', { value: r.model, unit: '', provenance: r.decelG.provenance }], ['Limiting axle', { value: r.limitingAxle, unit: '', provenance: r.decelG.provenance }],
          ...sensitivity.map((s) => ['Elasticity: ' + s.label, { value: s.elasticity, unit: '%/%', provenance: r.brakingDistance.provenance }] as const)]),
        series: { bias: bias.bias, decelVsBias: bias.decel, speedKmh: speeds.speed, distanceVsSpeed: speeds.distance },
        assumptions: uniq(results.flatMap((x) => x.assumptions)), missing: uniq(results.flatMap((x) => x.missing)),
      }
    },
  },
  'lap-simulation': {
    id: 'lap-simulation', version: DYNAMICS_MODEL.version, label: 'Lap simulation', description: 'Quasi-steady lap and vehicle performance (Phase 16 model)',
    run: ({ vehicle, track, handlingSpeedKmh }, progress) => {
      const r = analyseDynamics(vehicle, track, handlingSpeedKmh); progress?.(0.9)
      const lap = r.lap.value
      return {
        summary: Object.fromEntries([
          ['Lap time', { value: lap?.lapTime ?? null, unit: 's', provenance: r.lap.provenance }], pick('Top speed', r.topSpeed), pick('0–100 km/h', r.zeroTo100), pick('0–200 km/h', r.zeroTo200),
          pick('Lateral limit at 200 km/h', r.lateralAt200), pick('Braking at 200 km/h', r.brakingAt200), pick('Understeer gradient', r.handling.understeerGradient), pick('Yaw damping', r.handling.yawDamping),
          ...(lap ? lap.segmentTimes.map((s) => ['Segment: ' + s.name, { value: s.time, unit: 's', provenance: r.lap.provenance }] as const) : []),
        ]),
        series: (lap ? { distance: lap.distance, speedKmh: lap.speed.map((v) => v * 3.6) } : {}) as SolverOutput['series'],
        assumptions: uniq([...r.lap.assumptions, ...r.handling.understeerGradient.assumptions]), missing: uniq([...r.lap.missing, ...r.topSpeed.missing]),
      }
    },
  },
  'lap-parameter-sweep': {
    id: 'lap-parameter-sweep', version: DYNAMICS_MODEL.version, label: 'Lap-time parameter sweep', description: 'Lap time across a range of one vehicle input (Phase 16 model)',
    run: ({ vehicle, track, parameter, from, to, steps }, progress) => {
      const { provenances, missing } = coreOf(vehicle)
      progress?.(0.1)
      const sweep = parameterSweep(vehicle, track, parameter, from, to, steps)
      const edge = sweep.best ? sweep.best.value === sweep.values[0] || sweep.best.value === sweep.values[sweep.values.length - 1] : false
      const prov: Provenance = missing.length ? 'UNKNOWN' : [...provenances, track.provenance].includes('ILLUSTRATIVE') ? 'ILLUSTRATIVE' : [...provenances, track.provenance].includes('ESTIMATED') ? 'ESTIMATED' : 'DERIVED'
      return {
        summary: { 'Best value': { value: sweep.best?.value ?? null, unit: vehicle[parameter].unit, provenance: prov }, 'Best lap time': { value: sweep.best?.time ?? null, unit: 's', provenance: prov }, 'Optimum inside range': { value: sweep.best ? (edge ? 'no (edge of range)' : 'yes') : null, unit: '', provenance: prov } },
        series: { parameter: sweep.values, lapTime: sweep.times },
        assumptions: ['One input varied, all others held; ' + parameter + ' from ' + from + ' to ' + to + ' in ' + steps + ' steps', 'Quasi-steady point-mass lap model'], missing,
      }
    },
  },
  'suspension-sweep': {
    id: 'suspension-sweep', version: '1.0.0', label: 'Suspension kinematic sweep', description: 'Camber and toe over travel, rates (Phase 13 solver)',
    run: ({ hardpoints, provenance, springs, range, steps }, progress) => {
      const sweep = sweepTravel(hardpoints, range, steps); progress?.(0.6)
      const s = summarise(hardpoints, provenance, springs)
      const results = [s.camberGain, s.toeGain, s.motionRatio, s.rollCentre, s.installationRatio, s.wheelRate, s.rideFrequency, s.dampingRatio]
      return {
        summary: Object.fromEntries([pick('Camber gain', s.camberGain), pick('Bump steer', s.toeGain), pick('Motion ratio', s.motionRatio), pick('Roll centre height', s.rollCentre), pick('Installation ratio', s.installationRatio), pick('Wheel rate', s.wheelRate), pick('Ride frequency', s.rideFrequency), pick('Damping ratio', s.dampingRatio),
          ['Max closure error', { value: sweep.length ? Math.max(...sweep.map((x) => x.residual)) : null, unit: 'su', provenance: provenance }]]),
        series: { travel: sweep.map((x) => x.travel), camberDeg: sweep.map((x) => x.camberDeg), toeDeg: sweep.map((x) => x.toeDeg) },
        assumptions: uniq(results.flatMap((x) => x.assumptions)), missing: uniq(results.flatMap((x) => x.missing)),
      }
    },
  },
}

/** Runs a solver by id; the single dispatch point used by the worker, tests and package verification. */
export function runSolver(id: SolverId, input: unknown, progress?: (fraction: number) => void): SolverOutput {
  const solver = SOLVERS[id] as Solver<SolverId> | undefined
  if (!solver) throw new Error('Unknown solver ' + id)
  return solver.run(input as SolverInputs[SolverId], progress)
}
