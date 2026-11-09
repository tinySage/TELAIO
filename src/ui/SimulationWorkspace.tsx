import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileText, Play, ShieldCheck, Square, Trash2, Upload } from 'lucide-react'
import { useJobRunner } from '../sim/useJobRunner'
import { SOLVERS, type SolverId } from '../sim/solvers'
import { acceptExternalResults, createExternalRequest, verifyPackage, type ExternalRequest, type ExternalResults, type ExternalSolver, type PackageVerdict, type SimulationPackage } from '../sim/packages'
import { reportHtml, reportMarkdown } from '../sim/reports'
import { BRAKING_INPUT_SPECS } from '../engineering/braking'
import { VEHICLE_SPECS, validateTrack } from '../engineering/dynamics'
import { parseQuantity } from '../engineering/quantity'
import { FRONT_HARDPOINTS, REAR_HARDPOINTS } from '../model/hardpoints'
import { fmt, LineChart, ProvenanceBadge, storage } from './engineeringUi'

const EXTERNAL_KEY = 'telaio.externalSolvers.v1'
type ExternalStore = { solvers: ExternalSolver[]; requests: ExternalRequest[]; results: Record<string, ExternalResults> }

function save(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
const slug = (s: string) => s.replace(/[^\w-]+/g, '_').slice(0, 60)

/** Snapshots the relevant lab's current inputs from storage, or explains what is missing. */
function labInputs(solver: SolverId, sweep: { parameter: string; from: number; to: number; steps: number }, corner: 'front' | 'rear'): { inputs: unknown | null; note: string } {
  const json = (key: string) => { try { return JSON.parse(storage.read(key) ?? 'null') } catch { return null } }
  if (solver === 'braking-study') {
    const raw = json('telaio.brakingInputs.v1')
    if (!raw) return { inputs: null, note: 'No braking lab inputs yet' }
    const inputs = Object.fromEntries(BRAKING_INPUT_SPECS.map((s) => [s.key, parseQuantity(raw[s.key], s.unit)]))
    const known = Object.values(inputs).filter((q) => q.provenance !== 'UNKNOWN').length
    return { inputs: { inputs }, note: `Braking lab: ${known} of ${BRAKING_INPUT_SPECS.length} inputs established` }
  }
  if (solver === 'suspension-sweep') {
    const raw = json('telaio.suspension.v1')
    const hardpoints = raw?.hardpoints?.[corner] ?? (corner === 'front' ? FRONT_HARDPOINTS : REAR_HARDPOINTS)
    const springs = raw?.springs?.[corner] ?? { springRate: parseQuantity(null, 'N/mm'), rockerRatio: parseQuantity(null, 'ratio'), damperCoefficient: parseQuantity(null, 'N·s/m'), cornerMass: parseQuantity(null, 'kg') }
    return { inputs: { hardpoints, provenance: raw?.provenance?.[corner] ?? 'ILLUSTRATIVE', springs, range: 0.06, steps: 24 }, note: `Suspension lab: ${corner} corner, ${raw ? 'current' : 'default'} hardpoints` }
  }
  const raw = json('telaio.dynamics.v1')
  if (!raw?.a) return { inputs: null, note: 'No vehicle dynamics configuration yet' }
  const vehicle = { name: raw.a.name ?? 'Configuration A', ...Object.fromEntries(VEHICLE_SPECS.map((s) => [s.key, parseQuantity(raw.a[s.key], s.unit)])) }
  const track = raw.track && Array.isArray(raw.track.segments) && validateTrack(raw.track).length === 0 ? raw.track : null
  if (!track) return { inputs: null, note: 'Vehicle dynamics lab has no valid track' }
  if (solver === 'lap-simulation') return { inputs: { vehicle, track, handlingSpeedKmh: 150 }, note: `Dynamics lab: ${vehicle.name} on "${track.name}"` }
  return { inputs: { vehicle, track, ...sweep }, note: `Dynamics lab: ${vehicle.name}, ${sweep.parameter} ${sweep.from}→${sweep.to}` }
}

export default function SimulationWorkspace({ active, onNotice }: { active: boolean; onNotice: (text: string) => void }) {
  const { jobs, submit, cancel, remove } = useJobRunner()
  const [solver, setSolver] = useState<SolverId>('braking-study')
  const [name, setName] = useState('')
  const [sweep, setSweep] = useState({ parameter: 'clA', from: 2, to: 7, steps: 21 })
  const [corner, setCorner] = useState<'front' | 'rear'>('front')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [imported, setImported] = useState<SimulationPackage | null>(null)
  const [verdicts, setVerdicts] = useState<Record<string, PackageVerdict>>({})
  const [external, setExternal] = useState<ExternalStore>(() => { try { return { solvers: [], requests: [], results: {}, ...JSON.parse(storage.read(EXTERNAL_KEY) ?? '{}') } } catch { return { solvers: [], requests: [], results: {} } } })
  const [newSolver, setNewSolver] = useState<ExternalSolver>({ name: '', version: '', discipline: 'FEA' })
  const [settings, setSettings] = useState('{\n  "mesh": "",\n  "loadCase": ""\n}')
  const [requestDescription, setRequestDescription] = useState('')
  const [externalMessage, setExternalMessage] = useState<string | null>(null)
  const packageFile = useRef<HTMLInputElement>(null), resultsFile = useRef<HTMLInputElement>(null)
  const saveExternal = (next: ExternalStore) => { setExternal(next); storage.write(EXTERNAL_KEY, next) }

  // Re-read lab storage whenever this view becomes visible: the labs may have changed while it was hidden.
  const preview = useMemo(() => labInputs(solver, sweep, corner), [solver, sweep, corner, jobs.length, active]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null
  const pkg = imported ?? selectedJob?.package ?? null
  const verdict = pkg ? verdicts[pkg.sha256] : undefined
  const verify = async (p: SimulationPackage) => { const v = await verifyPackage(p); setVerdicts((all) => ({ ...all, [p.sha256]: v })); onNotice(v.message) }
  const series = pkg?.outputs.series ?? {}
  const chart = pkg?.solver.id === 'braking-study' ? { x: series.speedKmh, y: series.distanceVsSpeed, xl: 'Initial speed (km/h)', yl: 'Braking distance (m)' }
    : pkg?.solver.id === 'lap-simulation' ? { x: series.distance, y: series.speedKmh, xl: 'Distance (m)', yl: 'Speed (km/h)' }
    : pkg?.solver.id === 'lap-parameter-sweep' ? { x: series.parameter, y: series.lapTime, xl: 'Parameter value', yl: 'Lap time (s)' }
    : pkg?.solver.id === 'suspension-sweep' ? { x: series.travel, y: series.camberDeg, xl: 'Wheel travel (su)', yl: 'Camber (deg)' } : null

  return <section className="workspace">
    <div className="lab">
      <section className="lab-column lab-inputs">
        <div className="lab-subhead"><span>NEW JOB · RUNS IN A BACKGROUND WORKER</span></div>
        <div className="lab-field"><span>Solver</span><select value={solver} onChange={(e) => setSolver(e.target.value as SolverId)}>{Object.values(SOLVERS).map((s) => <option key={s.id} value={s.id}>{s.label} · v{s.version}</option>)}</select></div>
        <p className="lab-hint">{SOLVERS[solver].description}. Inputs are snapshotted from the lab at submission.</p>
        {solver === 'lap-parameter-sweep' && <div className="inline-form">
          <label>Parameter <select value={sweep.parameter} onChange={(e) => setSweep({ ...sweep, parameter: e.target.value })}>{VEHICLE_SPECS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <label>From <input type="number" value={sweep.from} onChange={(e) => setSweep({ ...sweep, from: Number(e.target.value) })}/></label><label>To <input type="number" value={sweep.to} onChange={(e) => setSweep({ ...sweep, to: Number(e.target.value) })}/></label>
          <label>Steps <input type="number" min={3} max={201} value={sweep.steps} onChange={(e) => setSweep({ ...sweep, steps: Math.max(3, Math.min(201, Number(e.target.value))) })}/></label></div>}
        {solver === 'suspension-sweep' && <div className="segmented">{(['front', 'rear'] as const).map((c) => <button key={c} className={corner === c ? 'active' : ''} onClick={() => setCorner(c)}>{c.toUpperCase()}</button>)}</div>}
        <p className={'lab-hint verdict ' + (preview.inputs ? 'ok' : 'bad')}>{preview.note}</p>
        <form className="state-save" onSubmit={(e) => { e.preventDefault(); const fresh = labInputs(solver, sweep, corner); if (!fresh.inputs) { onNotice(fresh.note); return } const id = submit(name.trim() || SOLVERS[solver].label + ' ' + new Date().toLocaleTimeString(), solver, fresh.inputs); setSelectedId(id); setImported(null); setName(''); onNotice('Job queued') }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Job name…" aria-label="Job name"/><button type="submit" disabled={!preview.inputs}><Play size={13}/> Run</button></form>
        <div className="lab-subhead"><span>JOBS · {jobs.length} STORED</span><button className="mini" onClick={() => packageFile.current?.click()}><Upload size={12}/> Import package</button>
          <input ref={packageFile} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = ''
            if (!file) return
            try { const p = JSON.parse(await file.text()) as SimulationPackage; setImported(p); setSelectedId(null); await verify(p) } catch { onNotice('Not a readable package file') }
          }}/></div>
        {jobs.length === 0 && <p className="lab-hint">No jobs yet.</p>}
        {jobs.map((job) => <div key={job.id} className={'job-row' + (job.id === selectedId && !imported ? ' selected' : '')}>
          <button className="job-main" onClick={() => { setSelectedId(job.id); setImported(null) }}>
            <strong>{job.name}</strong><span>{SOLVERS[job.solver].label} · {job.status}{job.status === 'running' ? ' ' + Math.round(job.progress * 100) + '%' : ''}{job.finishedAt && job.startedAt ? ' · ' + ((Date.parse(job.finishedAt) - Date.parse(job.startedAt)) / 1000).toFixed(2) + ' s' : ''}</span>
            {(job.status === 'running' || job.status === 'queued') && <i className="job-progress" style={{ width: Math.round(job.progress * 100) + '%' }}/>}
          </button>
          {(job.status === 'running' || job.status === 'queued') ? <button className="icon-button small" onClick={() => cancel(job.id)} aria-label={'Cancel ' + job.name}><Square size={12}/></button>
            : <button className="icon-button small" onClick={() => { remove(job.id); if (selectedId === job.id) setSelectedId(null) }} aria-label={'Delete ' + job.name}><Trash2 size={12}/></button>}
        </div>)}
        <div className="lab-subhead"><span>EXTERNAL SOLVERS · FEA / CFD / THERMAL</span></div>
        <p className="lab-hint">TELAIO does not run FEA, CFD or thermal solvers. It exports a sealed request for an external solver and accepts results only when they reference that exact request, labelled as computed externally. See docs/SOLVER_CONTRACT.md.</p>
        <div className="inline-form"><label>Name <input value={newSolver.name} onChange={(e) => setNewSolver({ ...newSolver, name: e.target.value })} style={{ width: 110 }}/></label><label>Version <input value={newSolver.version} onChange={(e) => setNewSolver({ ...newSolver, version: e.target.value })} style={{ width: 60 }}/></label>
          <label><select value={newSolver.discipline} onChange={(e) => setNewSolver({ ...newSolver, discipline: e.target.value as ExternalSolver['discipline'] })}>{['FEA', 'CFD', 'Thermal', 'Other'].map((d) => <option key={d}>{d}</option>)}</select></label>
          <button className="mini" disabled={!newSolver.name.trim() || !newSolver.version.trim()} onClick={() => { saveExternal({ ...external, solvers: [...external.solvers.filter((s) => s.name !== newSolver.name), newSolver] }); setNewSolver({ name: '', version: '', discipline: 'FEA' }) }}>Register</button></div>
        {external.solvers.map((s) => <p className="lab-hint" key={s.name}>• {s.name} {s.version} ({s.discipline})</p>)}
        {external.requests.map((r) => { const res = external.results[r.sha256]; return <div key={r.sha256} className="external-row">
          <strong>{r.description || 'Request'} → {r.solver.name}</strong><span>{r.sha256.slice(0, 12)}… · {res ? 'results received (' + res.provenance + ')' : 'awaiting results'}</span>
          {res && <span className="external-values">{Object.entries(res.values).map(([k, v]) => `${k}: ${v.value} ${v.unit}`).join(' · ')} — computed externally by {res.solver.name} {res.solver.version}</span>}
        </div> })}
        {external.requests.length > 0 && <><button className="mini" onClick={() => resultsFile.current?.click()}><Upload size={12}/> Import external results</button>
          <input ref={resultsFile} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = ''
            if (!file) return
            try {
              const results = JSON.parse(await file.text()) as ExternalResults
              const request = external.requests.find((r) => r.sha256 === results.requestSha256)
              if (!request) { setExternalMessage('✗ No request with hash ' + String(results.requestSha256).slice(0, 12) + '… exists here'); return }
              const check = await acceptExternalResults(request, results)
              if (!check.accepted) { setExternalMessage('✗ ' + check.errors.join('; ')); return }
              saveExternal({ ...external, results: { ...external.results, [request.sha256]: results } }); setExternalMessage('✓ Results accepted for "' + (request.description || 'request') + '", labelled as computed externally by ' + results.solver.name)
            } catch { setExternalMessage('✗ Not a readable results file') }
          }}/></>}
        {externalMessage && <p className={'lab-hint verdict ' + (externalMessage.startsWith('✓') ? 'ok' : 'bad')}>{externalMessage}</p>}
      </section>
      <section className="lab-column lab-results">
        {!pkg && !selectedJob && <div className="empty-state"><strong>No job selected</strong><p>Run a job from the current lab inputs, or import a package to verify it.</p></div>}
        {selectedJob && !pkg && <div className="empty-state"><strong>{selectedJob.name}</strong><p>{selectedJob.status === 'failed' ? selectedJob.error : selectedJob.status === 'cancelled' ? 'Cancelled.' : 'Waiting for results…'}</p></div>}
        {pkg && <>
          <div className="lab-subhead"><span>{imported ? 'IMPORTED PACKAGE' : 'RESULTS'} · {pkg.name}</span><span>{SOLVERS[pkg.solver.id]?.label ?? pkg.solver.id} v{pkg.solver.version}</span></div>
          <div className="lab-toolbar">
            <button onClick={() => verify(pkg)}><ShieldCheck size={13}/> Verify</button>
            <button onClick={() => save(slug(pkg.name) + '.telaio-sim.json', JSON.stringify(pkg, null, 2), 'application/json')}><Download size={13}/> Package</button>
            <button onClick={() => save(slug(pkg.name) + '-report.html', reportHtml(pkg, verdict), 'text/html')}><FileText size={13}/> Report HTML</button>
            <button onClick={() => save(slug(pkg.name) + '-report.md', reportMarkdown(pkg, verdict), 'text/markdown')}><FileText size={13}/> Report MD</button>
          </div>
          {verdict && <p className={'lab-hint verdict ' + (verdict.reproduced ? 'ok' : 'bad')}>{verdict.reproduced ? <CheckCircle2 size={12}/> : null} {verdict.message}{verdict.differences.length ? ': ' + verdict.differences.slice(0, 6).join(', ') : ''}</p>}
          <p className="lab-hint">SHA-256 <code className="hash">{pkg.sha256}</code></p>
          <div className="results">{Object.entries(pkg.outputs.summary).map(([k, o]) => <div className="result-row" key={k}><span className="result-label">{k}</span><strong className="result-value">{typeof o.value === 'number' ? fmt(o.value, 3) : o.value ?? '—'} <small>{o.unit}</small></strong><ProvenanceBadge value={o.provenance}/></div>)}</div>
          {chart?.x && chart.y && <LineChart x={chart.x.map((v) => v ?? 0)} series={[{ name: chart.yl, y: chart.y, colour: '#e0574e' }]} xLabel={chart.xl} yLabel={chart.yl}/>}
          <div className="result-notes">{pkg.outputs.missing.length > 0 && <p className="missing"><strong>Missing inputs:</strong> {pkg.outputs.missing.join(', ')}</p>}<ul>{pkg.outputs.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div>
          <div className="lab-subhead"><span>SEND TO AN EXTERNAL SOLVER</span></div>
          {external.solvers.length === 0 ? <p className="lab-hint">Register an external solver on the left first.</p> : <>
            <input className="qty-detail" placeholder="What should the external solver compute?" value={requestDescription} onChange={(e) => setRequestDescription(e.target.value)} aria-label="Request description"/>
            <textarea className="csv-input" rows={4} value={settings} onChange={(e) => setSettings(e.target.value)} aria-label="Solver settings JSON"/>
            <div className="lab-toolbar">{external.solvers.map((s) => <button key={s.name} onClick={async () => {
              let parsed: Record<string, unknown>
              try { parsed = JSON.parse(settings) } catch { setExternalMessage('✗ Solver settings must be valid JSON'); return }
              const request = await createExternalRequest(pkg, s, parsed, requestDescription.trim())
              saveExternal({ ...external, requests: [request, ...external.requests] })
              save(slug(pkg.name) + '-' + slug(s.name) + '-request.json', JSON.stringify(request, null, 2), 'application/json')
              setExternalMessage('✓ Request ' + request.sha256.slice(0, 12) + '… exported for ' + s.name)
            }}><Download size={13}/> Request for {s.name}</button>)}</div></>}
        </>}
      </section>
    </div>
  </section>
}
