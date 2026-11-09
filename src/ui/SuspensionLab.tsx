import { useCallback, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { Vec3 } from '../model/components'
import { FRONT_HARDPOINTS, REAR_HARDPOINTS, type CornerHardpoints } from '../model/hardpoints'
import { summarise, sweepTravel, type SpringDamperInputs } from '../engineering/suspension'
import { PROVENANCES, unknown, type Provenance } from '../engineering/quantity'
import { fmt, LineChart, ProvenanceBadge, QuantityInput, ResultNotes, ResultRow, storage, useStorageSubscription } from './engineeringUi'

export type Corner = 'front' | 'rear'
export type Stored = { hardpoints: Record<Corner, CornerHardpoints>; provenance: Record<Corner, Provenance>; springs: Record<Corner, SpringDamperInputs> }
export const SUSPENSION_KEY = 'telaio.suspension.v1'
const KEY = SUSPENSION_KEY
export const defaults = (): Stored => ({
  hardpoints: { front: structuredClone(FRONT_HARDPOINTS), rear: structuredClone(REAR_HARDPOINTS) },
  provenance: { front: 'ILLUSTRATIVE', rear: 'ILLUSTRATIVE' },
  springs: Object.fromEntries((['front', 'rear'] as Corner[]).map((c) => [c, { springRate: unknown('N/mm'), rockerRatio: unknown('ratio'), damperCoefficient: unknown('N·s/m'), cornerMass: unknown('kg') }])) as Record<Corner, SpringDamperInputs>,
})
export function loadSuspension(): Stored {
  const base = defaults()
  try {
    const raw = JSON.parse(storage.read(KEY) ?? 'null')
    if (!raw) return base
    for (const c of ['front', 'rear'] as Corner[]) {
      const h = raw.hardpoints?.[c]
      const valid = h && Array.isArray(h.links) && h.links.length === base.hardpoints[c].links.length && h.links.every((l: { inboard: number[]; outboard: number[] }) => [...l.inboard, ...l.outboard].every(Number.isFinite))
      if (valid) base.hardpoints[c] = h
      if (PROVENANCES.includes(raw.provenance?.[c])) base.provenance[c] = raw.provenance[c]
      if (raw.springs?.[c]) base.springs[c] = { ...base.springs[c], ...raw.springs[c] }
    }
  } catch { /* fall back to defaults */ }
  return base
}

export const POINTS: { key: string; label: string; get: (h: CornerHardpoints) => Vec3; set: (h: CornerHardpoints, v: Vec3) => CornerHardpoints }[] = [
  ...[0, 1, 2, 3, 4].flatMap((i) => (['inboard', 'outboard'] as const).map((end) => ({
    key: i + end, label: '', get: (h: CornerHardpoints) => h.links[i][end],
    set: (h: CornerHardpoints, v: Vec3) => ({ ...h, links: h.links.map((l, j) => j === i ? { ...l, [end]: v } : l) }),
  }))),
  { key: 'act-out', label: 'Actuation rod, outboard', get: (h) => h.actuation.outboard, set: (h, v) => ({ ...h, actuation: { ...h.actuation, outboard: v } }) },
  { key: 'act-in', label: 'Actuation rod, rocker', get: (h) => h.actuation.inboard, set: (h, v) => ({ ...h, actuation: { ...h.actuation, inboard: v } }) },
  { key: 'wc', label: 'Wheel centre', get: (h) => h.wheelCentre, set: (h, v) => ({ ...h, wheelCentre: v }) },
]

export const pointLabel = (h: CornerHardpoints, index: number) => POINTS[index].label || h.links[Math.floor(index / 2)].label + (index % 2 ? ', outboard' : ', inboard')

export default function SuspensionLab({ onNotice }: { onNotice: (text: string) => void }) {
  const [stored, setStored] = useState(loadSuspension)
  useStorageSubscription(KEY, useCallback(() => setStored(loadSuspension()), []))
  const [corner, setCorner] = useState<Corner>('front')
  const [range, setRange] = useState(0.06)
  const [steer, setSteer] = useState(0)
  const save = (next: Stored) => { setStored(next); storage.write(KEY, next) }
  const h = stored.hardpoints[corner], provenance = stored.provenance[corner]
  const sweep = useMemo(() => sweepTravel(h, range, 24, steer), [h, range, steer])
  const summary = useMemo(() => summarise(h, provenance, stored.springs[corner]), [h, provenance, stored.springs, corner])
  const solved = sweep.length > 0
  const travel = sweep.map((s) => s.travel)
  const setPoint = (index: number, axis: number, value: number) => {
    const point = POINTS[index], v = [...point.get(h)] as Vec3
    v[axis] = value
    save({ ...stored, hardpoints: { ...stored.hardpoints, [corner]: point.set(h, v) } })
  }
  const labelOf = (index: number) => pointLabel(h, index)

  return <div className="lab">
    <section className="lab-column lab-inputs">
      <div className="lab-toolbar">
        <div className="segmented">{(['front', 'rear'] as Corner[]).map((c) => <button key={c} className={corner === c ? 'active' : ''} onClick={() => setCorner(c)}>{c === 'front' ? 'FRONT · DOUBLE WISHBONE' : 'REAR · FIVE-LINK'}</button>)}</div>
        <button onClick={() => { const d = defaults(); save({ ...stored, hardpoints: { ...stored.hardpoints, [corner]: d.hardpoints[corner] }, provenance: { ...stored.provenance, [corner]: 'ILLUSTRATIVE' } }); onNotice('Hardpoints reset to the illustrative default') }}><RotateCcw size={13}/> Reset</button>
      </div>
      <div className="lab-field"><span>Hardpoint set provenance</span><select value={provenance} onChange={(e) => save({ ...stored, provenance: { ...stored.provenance, [corner]: e.target.value as Provenance } })}>{PROVENANCES.filter((p) => p !== 'DERIVED').map((p) => <option key={p}>{p}</option>)}</select></div>
      <p className="lab-hint">Left-hand corner in the study frame (x fwd, y up, z left; study units); the right side mirrors it. Defaults are a generic ILLUSTRATIVE layout, not SF-24 pickup points. Edits here and drags in the Design view's 3D hardpoint editor are the same data.</p>
      <div className="lab-subhead"><span>HARDPOINTS</span><span>X · Y · Z</span></div>
      <div className="hardpoint-table">{POINTS.map((point, index) => <div className="hardpoint-row" key={point.key}>
        <span>{labelOf(index)}</span>
        {[0, 1, 2].map((axis) => <input key={axis} type="number" step="0.01" aria-label={labelOf(index) + ' ' + 'xyz'[axis]} value={point.get(h)[axis]} onChange={(e) => setPoint(index, axis, Number(e.target.value))}/>)}
      </div>)}</div>
      <div className="lab-subhead"><span>SPRING · DAMPER</span></div>
      {([['springRate', 'Spring rate'], ['rockerRatio', 'Rocker ratio (spring / rod travel)'], ['damperCoefficient', 'Damper coefficient'], ['cornerMass', 'Sprung corner mass']] as const).map(([key, label]) =>
        <div className="lab-field" key={key}><span>{label}</span><QuantityInput label={label} value={stored.springs[corner][key]} onChange={(q) => save({ ...stored, springs: { ...stored.springs, [corner]: { ...stored.springs[corner], [key]: q } } })}/></div>)}
    </section>
    <section className="lab-column lab-results">
      <div className="inline-form">
        <label>Travel ± (su) <input type="number" step="0.01" min="0.01" max="0.2" value={range} onChange={(e) => setRange(Math.max(0.005, Number(e.target.value)))}/></label>
        <label>Rack / toe-link shift (su) <input type="number" step="0.005" value={steer} onChange={(e) => setSteer(Number(e.target.value))}/></label>
      </div>
      {!solved && <p className="issues"><span>The linkage does not close at static. Check the hardpoints: links may be too short or the upright degenerate.</span></p>}
      {solved && <>
        <div className="chart-title">Camber vs travel <small>deg · bump positive</small> <ProvenanceBadge value={provenance === 'UNKNOWN' ? 'UNKNOWN' : provenance === 'SOURCED' ? 'DERIVED' : provenance}/></div>
        <LineChart x={travel} series={[{ name: 'Camber', y: sweep.map((s) => s.camberDeg), colour: '#e0574e' }]} xLabel="Wheel travel (su)" yLabel="deg" markers={[{ x: 0, label: 'static' }]}/>
        <div className="chart-title">Toe vs travel <small>deg · toe-in positive</small></div>
        <LineChart x={travel} series={[{ name: 'Toe', y: sweep.map((s) => s.toeDeg), colour: '#78a9d1' }]} xLabel="Wheel travel (su)" yLabel="deg" markers={[{ x: 0, label: 'static' }]}/>
        <div className="results">
          <ResultRow label="Camber gain at static" result={summary.camberGain} format={(v: number) => fmt(v, 2)}/>
          <ResultRow label="Bump steer at static" result={summary.toeGain} format={(v: number) => fmt(v, 2)}/>
          <ResultRow label="Rod motion ratio" result={summary.motionRatio} format={(v: number) => fmt(v, 3)}/>
          <ResultRow label="Roll centre above ground" result={summary.rollCentre} format={(v: number) => fmt(v, 3)}/>
          <ResultRow label="Installation ratio" result={summary.installationRatio} format={(v: number) => fmt(v, 3)}/>
          <ResultRow label="Wheel rate" result={summary.wheelRate} format={(v: number) => fmt(v, 1)}/>
          <ResultRow label="Ride frequency" result={summary.rideFrequency} format={(v: number) => fmt(v, 2)}/>
          <ResultRow label="Damping ratio" result={summary.dampingRatio} format={(v: number) => fmt(v, 3)}/>
        </div>
        <p className="lab-hint">Solver closure: largest link-length error {summary.staticState ? summary.staticState.residual.toExponential(1) : '—'} su across the sweep's static pose · {sweep.length} poses solved.</p>
        <ResultNotes results={[summary.rollCentre, summary.motionRatio, summary.installationRatio, summary.wheelRate, summary.rideFrequency, summary.dampingRatio]}/>
      </>}
    </section>
  </div>
}
