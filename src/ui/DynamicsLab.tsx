import { useMemo, useState } from 'react'
import { Copy, FlaskConical, Import, Plus, Trash2 } from 'lucide-react'
import { coefficientsAt, validateAeroMap, type AeroMap, type WingConfiguration } from '../engineering/aero'
import { analyseDynamics, compareLaps, coreOf, simulateLap, emptyVehicle, illustrativeTrack, illustrativeVehicle, parameterSweep, validateTrack, VEHICLE_SPECS, type Track, type VehicleConfig } from '../engineering/dynamics'
import { PROVENANCES, parseQuantity, type Provenance } from '../engineering/quantity'
import { fmt, LineChart, ProvenanceBadge, QuantityInput, ResultNotes, ResultRow, storage } from './engineeringUi'

const KEY = 'telaio.dynamics.v1', BRAKING_KEY = 'telaio.brakingInputs.v1', AERO_KEY = 'telaio.aero.v1'
type Slot = 'a' | 'b'
type Stored = { a: VehicleConfig; b: VehicleConfig; track: Track | null }
const groups = [...new Set(VEHICLE_SPECS.map((s) => s.group))]
const parseVehicle = (raw: unknown, name: string): VehicleConfig => {
  const v = emptyVehicle(name)
  if (raw && typeof raw === 'object') { const r = raw as Record<string, unknown>; if (typeof r.name === 'string') v.name = r.name; for (const s of VEHICLE_SPECS) v[s.key] = parseQuantity(r[s.key], s.unit) }
  return v
}
function load(): Stored {
  try {
    const raw = JSON.parse(storage.read(KEY) ?? 'null')
    const track = raw?.track && Array.isArray(raw.track.segments) && validateTrack(raw.track).length === 0 ? raw.track as Track : null
    return { a: parseVehicle(raw?.a, 'Configuration A'), b: parseVehicle(raw?.b, 'Configuration B'), track }
  } catch { return { a: emptyVehicle('Configuration A'), b: emptyVehicle('Configuration B'), track: null } }
}

export default function DynamicsLab({ onNotice }: { onNotice: (text: string) => void }) {
  const [stored, setStored] = useState(load)
  const [slot, setSlot] = useState<Slot>('a')
  const [handlingKmh, setHandlingKmh] = useState(150)
  const [sweepKey, setSweepKey] = useState<(typeof VEHICLE_SPECS)[number]['key']>('clA')
  const [sweepRange, setSweepRange] = useState<[number, number]>([2, 7])
  const save = (next: Stored) => { setStored(next); storage.write(KEY, next) }
  const config = stored[slot]
  const setConfig = (next: VehicleConfig) => save({ ...stored, [slot]: next })
  const track = stored.track
  const trackErrors = track ? validateTrack(track) : []
  const usableTrack = track && trackErrors.length === 0 ? track : null
  const a = useMemo(() => analyseDynamics(stored.a, usableTrack, handlingKmh), [stored.a, usableTrack, handlingKmh])
  const b = useMemo(() => analyseDynamics(stored.b, usableTrack, handlingKmh), [stored.b, usableTrack, handlingKmh])
  const cmp = a.lap.value && b.lap.value ? compareLaps(a.lap.value, b.lap.value) : null
  const sweep = useMemo(() => usableTrack && a.lap.value ? parameterSweep(stored.a, usableTrack, sweepKey, sweepRange[0], sweepRange[1], 21) : null, [stored.a, usableTrack, sweepKey, sweepRange, a.lap.value])

  /** Lap time for each aero-lab wing configuration at the aero lab's operating point: the real downforce/drag trade. */
  const wingStudy = useMemo(() => {
    if (!usableTrack || !a.lap.value) return null
    try {
      const aero = JSON.parse(storage.read(AERO_KEY) ?? 'null') as { maps?: AeroMap[]; mapIndex?: number; wings?: WingConfiguration[]; front?: number; rear?: number } | null
      const map = aero?.maps?.[aero.mapIndex ?? 0]
      if (!map || validateAeroMap(map).length || !aero?.wings?.length) return null
      const rows = aero.wings.map((wing) => {
        const c = coefficientsAt(map, aero.front ?? 30, aero.rear ?? 80, wing)
        const { core } = coreOf({ ...stored.a, clA: { ...stored.a.clA, value: c.clA, provenance: c.provenance }, cdA: { ...stored.a.cdA, value: c.cdA, provenance: c.provenance } })
        return { name: wing.name, clA: c.clA, cdA: c.cdA, provenance: c.provenance, time: core ? simulateLap(core, usableTrack).lapTime : null }
      })
      const best = rows.filter((r) => r.time !== null).reduce<(typeof rows)[number] | null>((b, r) => !b || r.time! < b.time! ? r : b, null)
      return { map: map.name, front: aero.front ?? 30, rear: aero.rear ?? 80, rows, best }
    } catch { return null }
  }, [usableTrack, a.lap.value, stored.a])
  const atEdge = sweep?.best ? sweep.best.value === sweep.values[0] || sweep.best.value === sweep.values[sweep.values.length - 1] : false

  const importBraking = () => {
    try {
      const raw = JSON.parse(storage.read(BRAKING_KEY) ?? 'null')
      if (!raw) { onNotice('The braking lab has no inputs yet'); return }
      const pairs = [['mass', 'mass'], ['frontWeightFraction', 'frontWeightFraction'], ['cogHeight', 'cogHeight'], ['wheelbase', 'wheelbase'], ['mu', 'mu'], ['clA', 'clA'], ['cdA', 'cdA'], ['airDensity', 'airDensity']] as const
      const next = { ...config }
      let count = 0
      for (const [from, to] of pairs) { const qv = parseQuantity(raw[from], next[to].unit); if (qv.provenance !== 'UNKNOWN') { next[to] = qv; count++ } }
      setConfig(next); onNotice(`Imported ${count} input(s) from the braking lab into ${config.name}, keeping their provenance`)
    } catch { onNotice('Could not read the braking lab inputs') }
  }
  const setTrack = (next: Track) => save({ ...stored, track: next })

  return <div className="lab">
    <section className="lab-column lab-inputs">
      <div className="lab-toolbar">
        <div className="segmented">{(['a', 'b'] as Slot[]).map((s) => <button key={s} className={slot === s ? 'active' : ''} onClick={() => setSlot(s)}>{stored[s].name.toUpperCase()}</button>)}</div>
        <input className="lab-name" value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} aria-label="Configuration name"/>
      </div>
      <div className="lab-toolbar">
        <button onClick={importBraking} title="Mass, weight split, CoG height, wheelbase, μ and aero from the braking lab"><Import size={13}/> From braking lab</button>
        <button onClick={() => { setConfig({ ...illustrativeVehicle(config.name) }); onNotice('Loaded ILLUSTRATIVE generic single-seater values (not real data)') }}><FlaskConical size={13}/> Demo</button>
        <button onClick={() => { save({ ...stored, [slot === 'a' ? 'b' : 'a']: { ...structuredClone(config), name: stored[slot === 'a' ? 'b' : 'a'].name } }); onNotice('Copied ' + config.name + ' into the other configuration') }}><Copy size={13}/> Copy to {slot === 'a' ? 'B' : 'A'}</button>
      </div>
      {groups.map((group) => <div key={group}>
        <div className="lab-subhead"><span>{group.toUpperCase()}</span></div>
        {VEHICLE_SPECS.filter((s) => s.group === group).map((s) => <div className="lab-field" key={s.key}><span>{s.label}</span><QuantityInput label={s.label} value={config[s.key]} onChange={(qv) => setConfig({ ...config, [s.key]: qv })}/></div>)}
      </div>)}
      <div className="lab-subhead"><span>TRACK</span>
        <span className="lab-toolbar"><button className="mini" onClick={() => { setTrack(illustrativeTrack()); onNotice('Loaded an invented ILLUSTRATIVE test loop (not a real circuit)') }}><FlaskConical size={12}/> Demo loop</button>
          <button className="mini" onClick={() => setTrack({ ...(track ?? { name: 'New track', provenance: 'ESTIMATED' as Provenance, segments: [] }), segments: [...(track?.segments ?? []), { name: 'Segment ' + ((track?.segments.length ?? 0) + 1), length: 100, radius: 0 }] })}><Plus size={12}/> Segment</button></span></div>
      {track && <>
        <div className="inline-form"><label>Name <input value={track.name} onChange={(e) => setTrack({ ...track, name: e.target.value })} style={{ width: 220 }}/></label>
          <label>Provenance <select value={track.provenance} onChange={(e) => setTrack({ ...track, provenance: e.target.value as Provenance })}>{PROVENANCES.filter((p) => p !== 'UNKNOWN').map((p) => <option key={p}>{p}</option>)}</select></label></div>
        <div className="segment-row head"><span>Segment</span><span>Length m</span><span>Radius m (0 = straight)</span><span/></div>
        {track.segments.map((s, i) => <div className="segment-row" key={i}>
          <input value={s.name} onChange={(e) => setTrack({ ...track, segments: track.segments.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} aria-label="Segment name"/>
          <input type="number" value={s.length} onChange={(e) => setTrack({ ...track, segments: track.segments.map((x, j) => j === i ? { ...x, length: Number(e.target.value) } : x) })} aria-label={s.name + ' length'}/>
          <input type="number" value={s.radius} onChange={(e) => setTrack({ ...track, segments: track.segments.map((x, j) => j === i ? { ...x, radius: Number(e.target.value) } : x) })} aria-label={s.name + ' radius'}/>
          <button className="mini" onClick={() => setTrack({ ...track, segments: track.segments.filter((_, j) => j !== i) })} aria-label={'Remove ' + s.name}><Trash2 size={11}/></button>
        </div>)}
        <p className="lab-hint">{track.segments.reduce((sum, s) => sum + s.length, 0).toFixed(0)} m · {track.segments.length} segments{track.note ? ' · ' + track.note : ''}</p>
        {trackErrors.length > 0 && <div className="issues">{trackErrors.map((e) => <p key={e}>{e}</p>)}</div>}
      </>}
      {!track && <p className="lab-hint">No track. Build one from straights and constant-radius corners, or load the invented demo loop.</p>}
    </section>
    <section className="lab-column lab-results">
      <div className="lab-subhead"><span>PERFORMANCE · {stored.a.name.toUpperCase()}{b.lap.value || b.topSpeed.value !== null ? ' VS ' + stored.b.name.toUpperCase() : ''}</span></div>
      <div className="results compare-results">
        {([['Top speed', 'topSpeed', 1], ['0–100 km/h', 'zeroTo100', 2], ['0–200 km/h', 'zeroTo200', 2], ['Lateral limit at 200 km/h', 'lateralAt200', 2], ['Braking at 200 km/h', 'brakingAt200', 2], ['Lateral load transfer at 1 g', 'lateralTransferAt1g', 0]] as const).map(([label, key, digits]) => {
          const ra = a[key], rb = b[key]
          return <div className="result-row" key={key}><span className="result-label">{label}</span>
            <strong className="result-value">{ra.value === null ? '—' : fmt(ra.value, digits)}{rb.value !== null && ra.value !== null ? <small className="delta"> B {fmt(rb.value, digits)} ({rb.value - ra.value >= 0 ? '+' : ''}{fmt(rb.value - ra.value, digits)})</small> : null} <small>{ra.unit}</small></strong>
            <ProvenanceBadge value={ra.provenance}/></div>
        })}
        <div className="result-row"><span className="result-label">Lap time</span>
          <strong className="result-value">{a.lap.value ? fmt(a.lap.value.lapTime, 3) : '—'}{cmp ? <small className="delta"> B {fmt(b.lap.value!.lapTime, 3)} ({cmp.lapDelta >= 0 ? '+' : ''}{fmt(cmp.lapDelta, 3)})</small> : null} <small>s</small></strong><ProvenanceBadge value={a.lap.provenance}/></div>
      </div>
      {a.lap.value && <>
        <div className="chart-title">Speed trace <small>km/h · {fmt(a.lap.value.fullThrottleFraction * 100, 0)} % of the lap accelerating · max {fmt(a.lap.value.maxSpeed * 3.6, 1)} km/h</small></div>
        <LineChart x={a.lap.value.distance} series={[{ name: stored.a.name, y: a.lap.value.speed.map((v) => v * 3.6), colour: '#e0574e' }, ...(b.lap.value ? [{ name: stored.b.name, y: b.lap.value.speed.map((v) => v * 3.6), colour: '#78a9d1' }] : [])]} xLabel="Distance (m)" yLabel="km/h"/>
        <div className="segment-table">{a.lap.value.segmentTimes.map((s, i) => <div key={s.name + i} className="segment-result"><span>{s.name}</span><span>{fmt(s.time, 3)} s</span><span>min {fmt(s.minSpeed * 3.6, 0)}</span>{cmp && <span className={cmp.segments[i].delta > 0 ? 'slower' : 'faster'}>{cmp.segments[i].delta >= 0 ? '+' : ''}{fmt(cmp.segments[i].delta, 3)}</span>}</div>)}</div>
      </>}
      <div className="lab-subhead"><span>HANDLING · LINEAR SINGLE-TRACK</span><label className="inline-form">at <input type="number" value={handlingKmh} onChange={(e) => setHandlingKmh(Math.max(5, Number(e.target.value)))} style={{ width: 64 }}/> km/h</label></div>
      <div className="results">
        <ResultRow label="Understeer gradient (+ understeer)" result={a.handling.understeerGradient} format={(v: number) => fmt(v, 3)}/>
        <ResultRow label="Characteristic speed" result={a.handling.characteristicSpeed} format={(v: number) => fmt(v, 0)}/>
        <ResultRow label="Critical speed" result={a.handling.criticalSpeed} format={(v: number) => fmt(v, 0)}/>
        <ResultRow label="Yaw-rate gain r/δ" result={a.handling.yawRateGain} format={(v: number) => fmt(v, 3)}/>
        <ResultRow label="Yaw mode natural frequency" result={a.handling.yawNaturalFrequency} format={(v: number) => fmt(v, 2)}/>
        <ResultRow label="Yaw mode damping ratio" result={a.handling.yawDamping} format={(v: number) => fmt(v, 3)}/>
      </div>
      {a.handling.stable !== null && <p className={'lab-hint verdict ' + (a.handling.stable ? 'ok' : 'bad')}>{a.handling.stable ? 'Yaw mode stable at this speed' : 'Yaw mode UNSTABLE at this speed (above critical speed)'}</p>}
      <div className="lab-subhead"><span>OPTIMISE · LAP TIME VS ONE PARAMETER ({stored.a.name})</span></div>
      <div className="inline-form"><label>Parameter <select value={sweepKey} onChange={(e) => setSweepKey(e.target.value as typeof sweepKey)}>{VEHICLE_SPECS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
        <label>From <input type="number" value={sweepRange[0]} onChange={(e) => setSweepRange([Number(e.target.value), sweepRange[1]])}/></label><label>To <input type="number" value={sweepRange[1]} onChange={(e) => setSweepRange([sweepRange[0], Number(e.target.value)])}/></label></div>
      {sweep ? <><LineChart x={sweep.values} series={[{ name: 'Lap time', y: sweep.times, colour: '#f2c14e' }]} xLabel={VEHICLE_SPECS.find((s) => s.key === sweepKey)!.label} yLabel="s" markers={sweep.best ? [{ x: sweep.best.value, label: 'best' }] : []}/>
        {sweep.best && (atEdge
          ? <p className="lab-hint verdict bad">No optimum inside the range: lap time keeps improving to the edge ({fmt(sweep.best.value, 3)} {config[sweepKey].unit}). Varying one parameter alone carries no penalty in this model (for example, ClA has no drag cost unless CdA changes with it). Use the wing-configuration study below for coupled downforce and drag.</p>
          : <p className="lab-hint">Optimum inside the range: <strong>{fmt(sweep.best.value, 3)} {config[sweepKey].unit}</strong> → {fmt(sweep.best.time, 3)} s.</p>)}</> : <p className="lab-hint">Needs a computable lap for {stored.a.name}.</p>}
      <div className="lab-subhead"><span>WING CONFIGURATIONS · COUPLED DOWNFORCE AND DRAG</span></div>
      {wingStudy ? <>
        <p className="lab-hint">Each aero-lab wing configuration on map "{wingStudy.map}" at {wingStudy.front}/{wingStudy.rear} mm, run on this track with {stored.a.name}.</p>
        <div className="segment-table">{wingStudy.rows.map((r) => <div className="segment-result" key={r.name}><span>{r.name}{wingStudy.best?.name === r.name ? ' ★' : ''}</span><span>ClA {fmt(r.clA, 2)}</span><span>CdA {fmt(r.cdA, 2)}</span><span>{r.time === null ? '—' : fmt(r.time, 3) + ' s'}</span></div>)}</div>
        {wingStudy.best && <p className="lab-hint">Fastest: <strong>{wingStudy.best.name}</strong> ({wingStudy.best.provenance.toLowerCase()} coefficients). Result is specific to this track's mix of straights and corners.</p>}
      </> : <p className="lab-hint">Load an aero map with wing configurations in the Aerodynamics lab to compare them here.</p>}
      <ResultNotes results={[a.lap, a.topSpeed, a.handling.understeerGradient, a.lateralTransferAt1g]}/>
    </section>
  </div>
}
