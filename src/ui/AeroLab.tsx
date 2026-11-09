import { useMemo, useRef, useState } from 'react'
import { Download, FlaskConical, Plus, Send, Trash2, Upload } from 'lucide-react'
import { aeroForBraking, aeroMapToCsv, analyseAero, groundEffectSweep, illustrativeAeroMap, illustrativeWingConfigurations, parseAeroMapCsv, validateAeroMap, type AeroMap, type WingConfiguration } from '../engineering/aero'
import { emptyBrakingInputs, BRAKING_INPUT_SPECS } from '../engineering/braking'
import { PROVENANCES, parseQuantity, unknown, type Provenance, type Quantity } from '../engineering/quantity'
import { fmt, LineChart, newId, pct, ProvenanceBadge, QuantityInput, ResultNotes, ResultRow, storage } from './engineeringUi'

const KEY = 'telaio.aero.v1', BRAKING_KEY = 'telaio.brakingInputs.v1'
type Stored = { maps: AeroMap[]; wings: WingConfiguration[]; mapIndex: number; wingId: string; front: number; rear: number; speed: Quantity; airDensity: Quantity; wheelbase: Quantity }
function load(): Stored {
  const base: Stored = { maps: [], wings: [], mapIndex: 0, wingId: '', front: 30, rear: 80, speed: unknown('km/h'), airDensity: unknown('kg/m³'), wheelbase: unknown('m') }
  try {
    const raw = JSON.parse(storage.read(KEY) ?? 'null')
    if (!raw) return base
    return { ...base, ...raw, maps: (raw.maps ?? []).filter((m: AeroMap) => validateAeroMap(m).length === 0), speed: parseQuantity(raw.speed, 'km/h'), airDensity: parseQuantity(raw.airDensity, 'kg/m³'), wheelbase: parseQuantity(raw.wheelbase, 'm') }
  } catch { return base }
}

function Heatmap({ map, front, rear }: { map: AeroMap; front: number; rear: number }) {
  const w = 300, h = 170, pad = 34
  const all = map.clA.flat(), lo = Math.min(...all), hi = Math.max(...all)
  const cw = (w - pad) / map.rearRideHeights.length, ch = (h - pad) / map.frontRideHeights.length
  const colour = (v: number) => { const t = hi > lo ? (v - lo) / (hi - lo) : 0.5; return `hsl(${210 - t * 200} 55% ${22 + t * 30}%)` }
  const sx = (r: number) => pad + ((r - map.rearRideHeights[0]) / (map.rearRideHeights.at(-1)! - map.rearRideHeights[0])) * (cw * (map.rearRideHeights.length - 1)) + cw / 2
  const sy = (f: number) => ((f - map.frontRideHeights[0]) / (map.frontRideHeights.at(-1)! - map.frontRideHeights[0])) * (ch * (map.frontRideHeights.length - 1)) + ch / 2
  return <svg className="chart heatmap" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="ClA over front and rear ride height">
    {map.frontRideHeights.map((_f, i) => map.rearRideHeights.map((_r, j) => <g key={i + '-' + j}>
      <rect x={pad + j * cw} y={i * ch} width={cw - 1} height={ch - 1} fill={colour(map.clA[i][j])}/>
      <text x={pad + j * cw + cw / 2} y={i * ch + ch / 2 + 3} textAnchor="middle" className="cell">{map.clA[i][j].toFixed(2)}</text></g>))}
    {map.frontRideHeights.map((f, i) => <text key={'f' + f} x={pad - 4} y={i * ch + ch / 2 + 3} textAnchor="end">{f}</text>)}
    {map.rearRideHeights.map((r, j) => <text key={'r' + r} x={pad + j * cw + cw / 2} y={h - pad + 12} textAnchor="middle">{r}</text>)}
    <text x={pad} y={h - 4} className="axis-label">rear ride height (mm) →</text><text x={2} y={10} className="axis-label">front ↓</text>
    <circle cx={Math.min(w - 4, Math.max(pad, sx(rear)))} cy={Math.min(h - pad, Math.max(0, sy(front)))} r={5} className="op-point"/>
  </svg>
}

export default function AeroLab({ onNotice }: { onNotice: (text: string) => void }) {
  const [stored, setStored] = useState(load)
  const [csv, setCsv] = useState('')
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [meta, setMeta] = useState<{ name: string; provenance: Provenance; source: string }>({ name: '', provenance: 'SOURCED', source: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const save = (next: Stored) => { setStored(next); storage.write(KEY, next) }
  const map = stored.maps[stored.mapIndex] ?? null
  const wing = stored.wings.find((w) => w.id === stored.wingId) ?? null
  const inputs = { airDensity: stored.airDensity, speed: stored.speed, wheelbase: stored.wheelbase, frontRideHeight: stored.front, rearRideHeight: stored.rear }
  const report = useMemo(() => map ? analyseAero(map, inputs, wing) : null, [map, stored, wing]) // eslint-disable-line react-hooks/exhaustive-deps
  const ground = useMemo(() => map ? groundEffectSweep(map, stored.front, stored.rear, wing) : null, [map, stored.front, stored.rear, wing])
  const speeds = Array.from({ length: 31 }, (_, i) => i * 10)
  const speedForces = map ? speeds.map((v) => analyseAero(map, { ...inputs, speed: { value: v, unit: 'km/h', provenance: 'DERIVED' } }, wing)) : []

  const importCsv = (text: string) => {
    const { map: parsed, errors } = parseAeroMapCsv(text, { name: meta.name.trim() || 'Imported map ' + (stored.maps.length + 1), provenance: meta.provenance, ...(meta.provenance === 'SOURCED' ? { source: meta.source } : { note: meta.source }) })
    setCsvErrors(errors)
    if (parsed) { save({ ...stored, maps: [...stored.maps, parsed], mapIndex: stored.maps.length }); setCsv(''); onNotice('Imported aero map "' + parsed.name + '" (' + parsed.frontRideHeights.length + ' × ' + parsed.rearRideHeights.length + ', ' + parsed.provenance + ')') }
  }
  const sendToBraking = () => {
    if (!map) return
    const handoff = aeroForBraking(map, stored.front, stored.rear, wing)
    let braking = emptyBrakingInputs()
    try { const raw = JSON.parse(storage.read(BRAKING_KEY) ?? 'null'); if (raw) for (const s of BRAKING_INPUT_SPECS) braking[s.key] = parseQuantity(raw[s.key], s.unit) } catch { braking = emptyBrakingInputs() }
    storage.write(BRAKING_KEY, { ...braking, ...handoff, ...(stored.airDensity.value !== null ? { airDensity: stored.airDensity } : {}) })
    onNotice(`Sent ClA ${fmt(handoff.clA.value!, 3)}, CdA ${fmt(handoff.cdA.value!, 3)} and balance ${pct(handoff.aeroBalance.value!)} to the braking lab (${handoff.clA.provenance})`)
  }

  return <div className="lab">
    <section className="lab-column lab-inputs">
      <div className="lab-toolbar">
        <select value={stored.mapIndex} onChange={(e) => save({ ...stored, mapIndex: Number(e.target.value) })} aria-label="Aero map" disabled={!stored.maps.length}>{stored.maps.length ? stored.maps.map((m, i) => <option key={i} value={i}>{m.name}</option>) : <option>No aero map</option>}</select>
        <button onClick={() => { save({ ...stored, maps: [...stored.maps, illustrativeAeroMap()], mapIndex: stored.maps.length, wings: stored.wings.length ? stored.wings : illustrativeWingConfigurations(), wingId: stored.wingId || 'baseline' }); onNotice('Loaded ILLUSTRATIVE demo map and wing deltas (formula, not measured)') }}><FlaskConical size={13}/> Demo</button>
        <button disabled={!map} onClick={() => { const url = URL.createObjectURL(new Blob([aeroMapToCsv(map!)], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = map!.name.replace(/[^\w-]+/g, '_') + '.csv'; a.click(); URL.revokeObjectURL(url) }}><Download size={13}/> CSV</button>
        <button disabled={!map} onClick={() => { save({ ...stored, maps: stored.maps.filter((_, i) => i !== stored.mapIndex), mapIndex: 0 }); onNotice('Aero map deleted') }} aria-label="Delete map"><Trash2 size={13}/></button>
      </div>
      {map && <p className="lab-hint">{map.frontRideHeights.length} × {map.rearRideHeights.length} points · front {map.frontRideHeights[0]}–{map.frontRideHeights.at(-1)} mm · rear {map.rearRideHeights[0]}–{map.rearRideHeights.at(-1)} mm · <ProvenanceBadge value={map.provenance}/> {map.source ?? map.note}</p>}
      <div className="lab-subhead"><span>IMPORT MAP (CSV: front_mm, rear_mm, ClA, CdA, balance)</span></div>
      <div className="inline-form"><label>Name <input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} style={{ width: 150 }}/></label>
        <label>Provenance <select value={meta.provenance} onChange={(e) => setMeta({ ...meta, provenance: e.target.value as Provenance })}>{PROVENANCES.filter((p) => p !== 'UNKNOWN' && p !== 'DERIVED').map((p) => <option key={p}>{p}</option>)}</select></label></div>
      <input className="qty-detail" placeholder={meta.provenance === 'SOURCED' ? 'Source record: tunnel run, CFD case, report (required)' : 'Assumptions / note'} value={meta.source} onChange={(e) => setMeta({ ...meta, source: e.target.value })} aria-label="Map source"/>
      <textarea className="csv-input" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'front_mm,rear_mm,ClA,CdA,balance\n20,60,4.1,1.2,0.44\n…'} rows={4} aria-label="Aero map CSV"/>
      <div className="lab-toolbar"><button onClick={() => importCsv(csv)} disabled={!csv.trim()}><Plus size={13}/> Import pasted CSV</button><button onClick={() => fileRef.current?.click()}><Upload size={13}/> CSV file</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importCsv(await f.text()) }}/></div>
      {csvErrors.length > 0 && <div className="issues">{csvErrors.slice(0, 6).map((e) => <p key={e}>{e}</p>)}</div>}
      <div className="lab-subhead"><span>WING CONFIGURATIONS (DELTAS ON THE MAP)</span><button className="mini" onClick={() => save({ ...stored, wings: [...stored.wings, { id: newId('wing'), name: 'Configuration ' + (stored.wings.length + 1), dClA: 0, dCdA: 0, dBalance: 0, provenance: 'ESTIMATED' }] })}><Plus size={12}/> Add</button></div>
      <div className="wing-row head"><span/><span>Name</span><span>ΔClA</span><span>ΔCdA</span><span>Δbal</span><span>Provenance</span><span/></div>
      {stored.wings.map((w) => <div className="wing-row" key={w.id}>
        <input type="radio" name="wing" checked={stored.wingId === w.id} onChange={() => save({ ...stored, wingId: w.id })} aria-label={'Use ' + w.name}/>
        <input value={w.name} onChange={(e) => save({ ...stored, wings: stored.wings.map((x) => x.id === w.id ? { ...x, name: e.target.value } : x) })} aria-label="Wing configuration name"/>
        {(['dClA', 'dCdA', 'dBalance'] as const).map((k) => <input key={k} type="number" step="0.01" value={w[k]} aria-label={w.name + ' ' + k} onChange={(e) => save({ ...stored, wings: stored.wings.map((x) => x.id === w.id ? { ...x, [k]: Number(e.target.value) } : x) })}/>)}
        <select value={w.provenance} onChange={(e) => save({ ...stored, wings: stored.wings.map((x) => x.id === w.id ? { ...x, provenance: e.target.value as Provenance } : x) })}>{PROVENANCES.filter((p) => p !== 'UNKNOWN').map((p) => <option key={p}>{p}</option>)}</select>
        <button className="mini" onClick={() => save({ ...stored, wings: stored.wings.filter((x) => x.id !== w.id), wingId: stored.wingId === w.id ? '' : stored.wingId })} aria-label="Remove wing configuration"><Trash2 size={11}/></button>
      </div>)}
      <label className="lab-hint"><input type="radio" name="wing" checked={!stored.wingId} onChange={() => save({ ...stored, wingId: '' })}/> Map only, no wing delta</label>
      <div className="lab-subhead"><span>OPERATING POINT</span></div>
      <div className="inline-form"><label>Front ride height (mm) <input type="number" value={stored.front} onChange={(e) => save({ ...stored, front: Number(e.target.value) })}/></label><label>Rear ride height (mm) <input type="number" value={stored.rear} onChange={(e) => save({ ...stored, rear: Number(e.target.value) })}/></label></div>
      {([['speed', 'Speed'], ['airDensity', 'Air density'], ['wheelbase', 'Wheelbase']] as const).map(([k, label]) => <div className="lab-field" key={k}><span>{label}</span><QuantityInput label={label} value={stored[k]} onChange={(q) => save({ ...stored, [k]: q })}/></div>)}
      <div className="note-box"><p><strong>No flow solver.</strong> Coefficients come from the map you import (wind tunnel, CFD or other documented source). Airflow visualisation and CFD need a flow solver and mesh workflow; the Phase 17 solver contract is where that would connect.</p></div>
    </section>
    <section className="lab-column lab-results">
      {!map || !report ? <div className="empty-state"><strong>No aero map</strong><p>Import a CSV map from your own tunnel or CFD data, or load the illustrative demo.</p></div> : <>
        <div className="lab-toolbar"><button onClick={sendToBraking}><Send size={13}/> Send coefficients to braking lab</button></div>
        {report.warnings.map((w) => <p key={w} className="issues"><span>{w}</span></p>)}
        <div className="results">
          <div className="result-row"><span className="result-label">ClA · CdA · balance at {stored.front}/{stored.rear} mm{wing ? ' · ' + wing.name : ''}</span><strong className="result-value">{fmt(report.coefficients.clA, 3)} · {fmt(report.coefficients.cdA, 3)} · {pct(report.coefficients.balance)}</strong><ProvenanceBadge value={report.coefficients.provenance}/></div>
          <ResultRow label="Lift-to-drag" result={report.liftToDrag} format={(v: number) => fmt(v, 2)}/>
          <ResultRow label="Downforce" result={report.downforce} format={(v: number) => fmt(v, 0)}/>
          <ResultRow label="Front · rear downforce" result={report.frontDownforce} format={(v: number) => fmt(v, 0) + ' · ' + fmt(report.rearDownforce.value!, 0)}/>
          <ResultRow label="Drag" result={report.drag} format={(v: number) => fmt(v, 0)}/>
          <ResultRow label="Drag power" result={report.dragPower} format={(v: number) => fmt(v / 1000, 1) + ' k'}/>
          <ResultRow label="Centre of pressure from rear axle" result={report.copFromRearAxle} format={(v: number) => fmt(v, 3)}/>
        </div>
        <div className="results">
          <div className="result-row"><span className="result-label">∂ClA/∂front ride height</span><strong className="result-value">{fmt(report.sensitivity.dClA_dFront, 4)} m²/mm</strong><span/></div>
          <div className="result-row"><span className="result-label">∂ClA/∂rear ride height</span><strong className="result-value">{fmt(report.sensitivity.dClA_dRear, 4)} m²/mm</strong><span/></div>
          <div className="result-row"><span className="result-label">∂balance/∂pitch (nose down)</span><strong className="result-value">{fmt(report.sensitivity.dBalance_dPitch * 100, 3)} pp/mm</strong><span/></div>
        </div>
        <div className="chart-title">ClA map <small>operating point marked</small></div>
        <Heatmap map={map} front={stored.front} rear={stored.rear}/>
        {ground && <><div className="chart-title">Ground effect: ClA as the car lowers uniformly <small>map peak at front {fmt(ground.peakAtFront, 1)} mm</small></div>
          <LineChart x={ground.frontRideHeight} series={[{ name: 'ClA', y: ground.clA, colour: '#e0574e' }]} xLabel="Front ride height (mm), rear moving equally" yLabel="m²" markers={[{ x: stored.front, label: 'now' }]}/></>}
        <div className="chart-title">Downforce and drag vs speed <small>N</small></div>
        <LineChart x={speeds} series={[{ name: 'Downforce', y: speedForces.map((r) => r.downforce.value), colour: '#e0574e' }, { name: 'Drag', y: speedForces.map((r) => r.drag.value), colour: '#78a9d1' }]} xLabel="Speed (km/h)" yLabel="N"/>
        <ResultNotes results={[report.downforce, report.copFromRearAxle]}/>
      </>}
    </section>
  </div>
}
