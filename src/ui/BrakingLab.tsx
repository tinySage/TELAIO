import { useMemo, useRef, useState } from 'react'
import { Download, FlaskConical, Import, Save, Trash2, Upload } from 'lucide-react'
import type { Part } from '../model/components'
import { analyseBraking, BRAKING_INPUT_SPECS, BRAKING_MODEL, biasSweep, createStudy, distanceSensitivity, emptyBrakingInputs, illustrativeBrakingInputs, reproduceStudy, speedSweep, type BrakingInputs, type StudyRecord } from '../engineering/braking'
import { computeMassProperties, type MassConfiguration } from '../engineering/massProperties'
import { parseQuantity, type Quantity } from '../engineering/quantity'
import { fmt, LineChart, pct, QuantityInput, ResultNotes, ResultRow, storage } from './engineeringUi'

const INPUT_KEY = 'telaio.brakingInputs.v1', STUDY_KEY = 'telaio.brakingStudies.v1'
const groups = [...new Set(BRAKING_INPUT_SPECS.map((s) => s.group))]

function loadInputs(): BrakingInputs {
  const base = emptyBrakingInputs()
  try { const raw = JSON.parse(storage.read(INPUT_KEY) ?? 'null'); if (raw) for (const s of BRAKING_INPUT_SPECS) base[s.key] = parseQuantity(raw[s.key], s.unit) } catch { /* defaults */ }
  return base
}
function loadStudies(): StudyRecord[] {
  try { const raw = JSON.parse(storage.read(STUDY_KEY) ?? '[]'); return Array.isArray(raw) ? raw.filter((s) => s?.model?.id === BRAKING_MODEL.id && s.inputs && s.outputs) : [] } catch { return [] }
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export default function BrakingLab({ parts, installedIds, massConfigurations, onNotice }: { parts: Part[]; installedIds: string[]; massConfigurations: MassConfiguration[]; onNotice: (text: string) => void }) {
  const [inputs, setInputs] = useState(loadInputs)
  const [studies, setStudies] = useState(loadStudies)
  const [studyName, setStudyName] = useState('')
  const [massSource, setMassSource] = useState(massConfigurations[0]?.id ?? '')
  const [verdict, setVerdict] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const update = (next: BrakingInputs) => { setInputs(next); storage.write(INPUT_KEY, next) }
  const saveStudies = (next: StudyRecord[]) => { setStudies(next); storage.write(STUDY_KEY, next) }
  const report = useMemo(() => analyseBraking(inputs), [inputs])
  const bias = useMemo(() => biasSweep(inputs), [inputs])
  const speeds = useMemo(() => speedSweep(inputs), [inputs])
  const sensitivity = useMemo(() => distanceSensitivity(inputs), [inputs])

  const importFromMassLab = () => {
    const config = massConfigurations.find((c) => c.id === massSource)
    if (!config) return
    const m = computeMassProperties(config, parts, installedIds)
    if (m.totalMass.value === null || m.frontFraction.value === null) { onNotice('Mass lab configuration "' + config.name + '" has no computable mass yet'); return }
    const from = (value: number, unit: string, provenance: Quantity['provenance'], what: string): Quantity =>
      ({ value, unit, provenance, ...(provenance === 'SOURCED' ? { source: 'Mass lab: ' + config.name } : { note: what + ' from mass lab configuration "' + config.name + '"' }) })
    const next = { ...inputs, mass: from(m.totalMass.value, 'kg', m.totalMass.provenance, 'Total mass'), frontWeightFraction: from(m.frontFraction.value, 'fraction', m.frontFraction.provenance, 'Front axle share') }
    const scale = config.scale.value
    // CoG height is NOT imported: the study geometry is not to scale vertically (wheel radius 0.64 su against
    // a 2.12 su wheelbase, roughly three times real proportions), so a height derived from it would be wrong
    // while looking legitimate. Longitudinal quantities (front share, wheelbase) depend only on mass placement
    // along the car and on the scale definition itself.
    if (scale) next.wheelbase = from((m.axles.front - m.axles.rear) * scale, 'm', config.scale.provenance === 'SOURCED' ? 'DERIVED' : config.scale.provenance, 'Study wheelbase × scale')
    update(next)
    onNotice('Imported mass, front share' + (scale ? ' and wheelbase' : '') + ' from "' + config.name + '" (' + m.totalMass.provenance + '). CoG height not imported: the study geometry is not to scale vertically')
  }

  const saveStudy = () => {
    const name = studyName.trim() || 'Study ' + (studies.length + 1)
    saveStudies([createStudy(name, inputs), ...studies.filter((s) => s.name !== name)]); setStudyName(''); onNotice('Saved braking study "' + name + '"')
  }
  const check = (study: StudyRecord, source: string) => {
    const r = reproduceStudy(study)
    setVerdict(r.reproducible ? `✓ "${study.name}" (${source}) reproduces exactly with ${BRAKING_MODEL.id} ${BRAKING_MODEL.version}` : !r.modelMatches ? `✗ "${study.name}" was made with ${study.model?.id} ${study.model?.version}; this build runs ${BRAKING_MODEL.version}` : `✗ "${study.name}" differs on: ${r.differences.join(', ')}`)
  }

  return <div className="lab">
    <section className="lab-column lab-inputs">
      <div className="lab-toolbar">
        <select value={massSource} onChange={(e) => setMassSource(e.target.value)} aria-label="Mass lab configuration">{massConfigurations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button onClick={importFromMassLab} title="Take mass, front share and wheelbase from the mass lab"><Import size={13}/> From mass lab</button>
        <button onClick={() => { update(illustrativeBrakingInputs()); onNotice('Loaded ILLUSTRATIVE textbook-order inputs (not real data)') }}><FlaskConical size={13}/> Demo</button>
        <button onClick={() => { update(emptyBrakingInputs()); onNotice('Braking inputs cleared') }}>Clear</button>
      </div>
      {groups.map((group) => <div key={group}>
        <div className="lab-subhead"><span>{group.toUpperCase()}</span></div>
        {BRAKING_INPUT_SPECS.filter((s) => s.group === group).map((s) => <div className="lab-field" key={s.key}><span>{s.label}</span><QuantityInput label={s.label} value={inputs[s.key]} onChange={(q) => update({ ...inputs, [s.key]: q })}/></div>)}
      </div>)}
      <div className="lab-subhead"><span>STUDIES · REPRODUCIBLE RECORDS</span></div>
      <form className="state-save" onSubmit={(e) => { e.preventDefault(); saveStudy() }}><input value={studyName} onChange={(e) => setStudyName(e.target.value)} placeholder="Study name…" aria-label="Study name"/><button type="submit"><Save size={13}/> Save</button>
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={13}/> Import</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file) return
          try { const study = JSON.parse(await file.text()) as StudyRecord; if (!study?.inputs || !study.outputs) throw new Error(); for (const s of BRAKING_INPUT_SPECS) study.inputs[s.key] = parseQuantity(study.inputs[s.key], s.unit); check(study, 'imported file'); saveStudies([study, ...studies.filter((x) => x.name !== study.name)]) }
          catch { setVerdict('✗ Not a TELAIO braking study file') }
        }}/></form>
      {verdict && <p className={'lab-hint verdict ' + (verdict.startsWith('✓') ? 'ok' : 'bad')}>{verdict}</p>}
      {studies.map((study) => <div className="state-row" key={study.name}>
        <button className="state-restore" onClick={() => { update(structuredClone(study.inputs)); check(study, 'stored'); onNotice('Loaded study "' + study.name + '"') }} title="Load inputs and verify"><strong>{study.name}</strong><span>{new Date(study.createdAt).toLocaleString()} · v{study.model.version}</span></button>
        <button className="icon-button small" onClick={() => download(study.name.replace(/[^\w-]+/g, '_') + '.telaio-braking.json', study)} aria-label={'Export ' + study.name}><Download size={12}/></button>
        <button className="icon-button small" onClick={() => saveStudies(studies.filter((s) => s.name !== study.name))} aria-label={'Delete ' + study.name}><Trash2 size={12}/></button>
      </div>)}
    </section>
    <section className="lab-column lab-results">
      <div className="lab-subhead"><span>RESULTS · {report.model === 'aero' ? 'AERO MODEL (SPEED-DEPENDENT)' : 'CONSTANT MODEL (NO AERO)'}</span>{report.limitingAxle && <span>LIMIT: {report.limitingAxle.toUpperCase()} AXLE LOCKS</span>}</div>
      <div className="results">
        <ResultRow label={report.model === 'aero' ? 'Peak deceleration (at initial speed)' : 'Achievable deceleration'} result={report.decelG} format={(v: number) => fmt(v, 3)}/>
        <ResultRow label="Ideal bias at that deceleration" result={report.idealBiasAtLimit} format={(v: number) => pct(v)}/>
        <ResultRow label="Braking distance" result={report.brakingDistance} format={(v: number) => fmt(v, 2)}/>
        <ResultRow label="Stopping distance incl. reaction" result={report.stoppingDistance} format={(v: number) => fmt(v, 2)}/>
        <ResultRow label="Time to stop" result={report.stopTime} format={(v: number) => fmt(v, 3)}/>
        <ResultRow label="Longitudinal load transfer" result={report.loadTransfer} format={(v: number) => fmt(v, 0)}/>
        <ResultRow label="Front axle load" result={report.frontLoad} format={(v: number) => fmt(v, 0)}/>
        <ResultRow label="Rear axle load" result={report.rearLoad} format={(v: number) => fmt(v, 0)}/>
        <ResultRow label="Brake torque, front wheel" result={report.frontTorquePerWheel} format={(v: number) => fmt(v, 0)}/>
        <ResultRow label="Brake torque, rear wheel" result={report.rearTorquePerWheel} format={(v: number) => fmt(v, 0)}/>
        <ResultRow label="Peak front brake power" result={report.peakFrontPower} format={(v: number) => fmt(v / 1000, 1) + ' k'}/>
        <ResultRow label="Front rotor temperature rise (one stop)" result={report.rotorTemperatureRise} format={(v: number) => fmt(v, 1)}/>
      </div>
      <div className="chart-title">Achievable deceleration vs brake bias <small>g</small></div>
      <LineChart x={bias.bias.map((b) => b * 100)} series={[{ name: 'Decel', y: bias.decel, colour: '#e0574e' }]} xLabel="Front bias (%)" yLabel="g"
        markers={[...(inputs.brakeBias.value !== null ? [{ x: inputs.brakeBias.value * 100, label: 'current' }] : []), ...(bias.ideal !== null ? [{ x: bias.ideal * 100, label: 'best' }] : [])]}/>
      <div className="chart-title">Braking distance vs initial speed <small>m</small></div>
      <LineChart x={speeds.speed} series={[{ name: 'Distance', y: speeds.distance, colour: '#78a9d1' }]} xLabel="Initial speed (km/h)" yLabel="m"/>
      <div className="lab-subhead"><span>SENSITIVITY OF BRAKING DISTANCE</span><span>% CHANGE PER 1 % INPUT</span></div>
      {sensitivity.length === 0 ? <p className="lab-hint">Needs a computable braking distance.</p> : <div className="results">{sensitivity.map((s) => <div className="result-row" key={s.key}><span className="result-label">{s.label}</span><strong className="result-value">{s.elasticity > 0 ? '+' : ''}{fmt(s.elasticity, 3)}</strong><span/></div>)}</div>}
      <ResultNotes results={[report.brakingDistance, report.rotorTemperatureRise, report.stoppingDistance]}/>
    </section>
  </div>
}
