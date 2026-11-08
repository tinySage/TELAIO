import { useMemo, useState } from 'react'
import { Copy, FlaskConical, Plus, Trash2 } from 'lucide-react'
import type { Part, Vec3 } from '../model/components'
import { ballastForTarget, compareMassReports, computeMassProperties, illustrativeDemoConfiguration, MASS_CONFIG_STORAGE_KEY, newMassConfiguration, parseMassConfigurations, type MassConfiguration } from '../engineering/massProperties'
import { unknown } from '../engineering/quantity'
import { fmt, newId, pct, ProvenanceBadge, QuantityInput, ResultNotes, ResultRow, storage } from './engineeringUi'

const vec = (v: Vec3, digits = 3) => '(' + v.map((x) => fmt(x, digits)).join(', ') + ')'

export function useMassConfigurations(parts: Part[]) {
  const [initial] = useState(() => parseMassConfigurations(storage.read(MASS_CONFIG_STORAGE_KEY), new Set(parts.map((p) => p.id))))
  const [configurations, setConfigurations] = useState<MassConfiguration[]>(() => initial.configurations.length ? initial.configurations : [newMassConfiguration('mass-1', 'Baseline')])
  const save = (next: MassConfiguration[]) => { setConfigurations(next); storage.write(MASS_CONFIG_STORAGE_KEY, next) }
  return { configurations, save, warnings: initial.warnings }
}

export default function MassLab({ parts, installedIds, configurations, save, onNotice }: { parts: Part[]; installedIds: string[]; configurations: MassConfiguration[]; save: (c: MassConfiguration[]) => void; onNotice: (text: string) => void }) {
  const [activeId, setActiveId] = useState(configurations[0]?.id ?? '')
  const [compareId, setCompareId] = useState('')
  const [filter, setFilter] = useState<'all' | 'unknown' | 'known' | 'excluded'>('all')
  const [target, setTarget] = useState(0.45)
  const [ballastX, setBallastX] = useState(0.3)
  const active = configurations.find((c) => c.id === activeId) ?? configurations[0]
  const update = (next: MassConfiguration) => save(configurations.map((c) => c.id === next.id ? next : c))
  const report = useMemo(() => computeMassProperties(active, parts, installedIds), [active, parts, installedIds])
  const compareConfig = configurations.find((c) => c.id === compareId)
  const compareReport = useMemo(() => compareConfig ? computeMassProperties(compareConfig, parts, installedIds) : null, [compareConfig, parts, installedIds])
  const comparison = compareReport ? compareMassReports(compareReport, report) : null
  const installed = parts.filter((p) => installedIds.includes(p.id))
  const rows = installed.filter((p) => {
    const excluded = p.id in active.excluded, known = active.masses[p.id]?.provenance && active.masses[p.id].provenance !== 'UNKNOWN'
    return filter === 'all' || (filter === 'excluded' ? excluded : filter === 'known' ? known && !excluded : !known && !excluded)
  })
  const nameOf = (id: string) => id.startsWith('ballast:') ? 'ballast ' + id.slice(8) : parts.find((p) => p.id === id)?.name ?? id
  const neededBallast = ballastForTarget(report, ballastX, target)

  const addConfiguration = (config: MassConfiguration, message: string) => { save([...configurations, config]); setActiveId(config.id); onNotice(message) }

  return <div className="lab mass-lab">
    <section className="lab-column lab-inputs">
      <div className="lab-toolbar">
        <select value={active.id} onChange={(e) => setActiveId(e.target.value)} aria-label="Mass configuration">{configurations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input className="lab-name" value={active.name} onChange={(e) => update({ ...active, name: e.target.value })} aria-label="Configuration name"/>
        <button onClick={() => addConfiguration(newMassConfiguration(newId('mass'), 'Configuration ' + (configurations.length + 1)), 'New empty mass configuration')} title="New configuration"><Plus size={13}/></button>
        <button onClick={() => addConfiguration({ ...structuredClone(active), id: newId('mass'), name: active.name + ' (copy)' }, 'Configuration duplicated')} title="Duplicate"><Copy size={13}/></button>
        <button onClick={() => addConfiguration(illustrativeDemoConfiguration(parts, newId('demo')), 'Loaded ILLUSTRATIVE demo values (not real data)')} title="Load illustrative demo"><FlaskConical size={13}/> Demo</button>
        <button disabled={configurations.length < 2} onClick={() => { const next = configurations.filter((c) => c.id !== active.id); save(next); setActiveId(next[0].id); onNotice('Configuration deleted') }} title="Delete configuration"><Trash2 size={13}/></button>
      </div>
      <div className="lab-field"><span>Study-frame scale</span><QuantityInput label="Scale" value={active.scale} onChange={(scale) => update({ ...active, scale })}/></div>
      <p className="lab-hint">Metres per study unit. Needed for CoG in metres and inertia; axle split does not need it.</p>
      <div className="lab-subhead"><span>COMPONENT MASSES · {installed.length} INSTALLED</span>
        <div className="segmented">{(['all', 'unknown', 'known', 'excluded'] as const).map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>)}</div></div>
      <div className="mass-table">{rows.map((part) => {
        const excluded = part.id in active.excluded
        return <div className={'mass-row' + (excluded ? ' excluded' : '')} key={part.id}>
          <span className="mass-name" title={part.id}>{part.name}<small>{part.system}</small></span>
          {excluded ? <input className="exclude-reason" value={active.excluded[part.id]} placeholder="Reason for exclusion" onChange={(e) => update({ ...active, excluded: { ...active.excluded, [part.id]: e.target.value } })} aria-label={part.name + ' exclusion reason'}/>
            : <QuantityInput compact label={part.name} value={active.masses[part.id] ?? unknown('kg')} onChange={(q) => update({ ...active, masses: { ...active.masses, [part.id]: q } })}/>}
          <label className="exclude-toggle" title="Exclude from totals"><input type="checkbox" checked={excluded} onChange={() => {
            const next = { ...active.excluded }
            if (excluded) delete next[part.id]; else next[part.id] = ''
            update({ ...active, excluded: next })
          }}/>excl.</label>
        </div>
      })}</div>
      <div className="lab-subhead"><span>BALLAST</span><button className="mini" onClick={() => update({ ...active, ballast: [...active.ballast, { id: newId('b'), label: 'Ballast ' + (active.ballast.length + 1), mass: unknown('kg'), position: [0.3, -0.27, 0] }] })}><Plus size={12}/> Add</button></div>
      {active.ballast.length === 0 && <p className="lab-hint">No ballast. Positions are study-frame coordinates (x fwd, y up, z left).</p>}
      {active.ballast.map((item) => <div className="ballast-row" key={item.id}>
        <input value={item.label} onChange={(e) => update({ ...active, ballast: active.ballast.map((b) => b.id === item.id ? { ...b, label: e.target.value } : b) })} aria-label="Ballast label"/>
        <QuantityInput compact label={item.label} value={item.mass} onChange={(mass) => update({ ...active, ballast: active.ballast.map((b) => b.id === item.id ? { ...b, mass } : b) })}/>
        {[0, 1, 2].map((axis) => <input key={axis} className="coord" type="number" step="0.01" aria-label={item.label + ' ' + 'xyz'[axis]} value={item.position[axis]} onChange={(e) => update({ ...active, ballast: active.ballast.map((b) => b.id === item.id ? { ...b, position: b.position.map((v, i) => i === axis ? Number(e.target.value) : v) as Vec3 } : b) })}/>)}
        <button className="mini" onClick={() => update({ ...active, ballast: active.ballast.filter((b) => b.id !== item.id) })} aria-label="Remove ballast"><Trash2 size={12}/></button>
      </div>)}
    </section>
    <section className="lab-column lab-results">
      <div className="lab-subhead"><span>RESULTS · {report.contributors} CONTRIBUTORS</span></div>
      <div className="results">
        <ResultRow label="Total mass" result={report.totalMass} format={(v: number) => fmt(v, 2)}/>
        <ResultRow label="CoG (study frame)" result={report.cog} format={(v: Vec3) => vec(v)}/>
        <ResultRow label="CoG" result={report.cogMetres} format={(v: Vec3) => vec(v)}/>
        <ResultRow label="Front axle share" result={report.frontFraction} format={(v: number) => pct(v)}/>
      </div>
      {report.inertia.value && <div className="tensor"><div className="tensor-head">Inertia tensor about CoG <small>kg·m²</small> <ProvenanceBadge value={report.inertia.provenance}/></div>
        <table><tbody>{report.inertia.value.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{fmt(v, 2)}</td>)}</tr>)}</tbody></table></div>}
      {report.issues.length > 0 && <div className="issues">{report.issues.map((issue) => <p key={issue}>{issue}</p>)}</div>}
      <ResultNotes results={[report.totalMass, report.inertia]} missingLabel={nameOf}/>
      <div className="lab-subhead"><span>BALLAST PLACEMENT</span></div>
      <div className="inline-form">
        <label>Target front share <input type="number" step="0.005" min="0" max="1" value={target} onChange={(e) => setTarget(Number(e.target.value))}/></label>
        <label>Ballast x (su) <input type="number" step="0.01" value={ballastX} onChange={(e) => setBallastX(Number(e.target.value))}/></label>
      </div>
      <p className="lab-hint">{report.totalMass.value === null ? 'Needs a computable total mass and CoG.' : neededBallast === null ? 'Not reachable by adding ballast at this x.' : <>Add <strong>{fmt(neededBallast, 2)} kg</strong> at x = {fmt(ballastX, 3)} su to reach {pct(target)} front ({report.totalMass.provenance.toLowerCase()} inputs).</>}</p>
      <div className="lab-subhead"><span>COMPARE</span>
        <select value={compareId} onChange={(e) => setCompareId(e.target.value)} aria-label="Compare with"><option value="">— baseline —</option>{configurations.filter((c) => c.id !== active.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      {comparison ? <div className="results">
        <div className="result-row"><span className="result-label">Δ mass (this − baseline)</span><strong className="result-value">{comparison.deltaMass === null ? '—' : fmt(comparison.deltaMass, 2) + ' kg'}</strong><ProvenanceBadge value={comparison.provenance}/></div>
        <div className="result-row"><span className="result-label">Δ CoG (su)</span><strong className="result-value">{comparison.deltaCog ? vec(comparison.deltaCog) : '—'}</strong></div>
        <div className="result-row"><span className="result-label">Δ front share</span><strong className="result-value">{comparison.deltaFrontFraction === null ? '—' : (comparison.deltaFrontFraction * 100).toFixed(2) + ' pp'}</strong></div>
      </div> : <p className="lab-hint">Pick a configuration to compare against.</p>}
    </section>
  </div>
}
