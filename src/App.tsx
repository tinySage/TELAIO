import { useMemo, useState } from 'react'
import { Activity, Box, ChevronDown, ChevronRight, CircleHelp, Crosshair, Eye, EyeOff, Layers3, Maximize2, RotateCcw, Search, Settings2, ShieldCheck, SlidersHorizontal, Wrench } from 'lucide-react'
import AssemblyScene from './scene/AssemblyScene'
import { useGeometryAssets } from './scene/useGeometryAssets'
import { parts, provenanceLabel } from './model/components'
import { dependencies, interfaces, validateAssemblyModel, getRemovalBlockers, getRemovalSequence, getInstallationBlockers, validateInstalledSet } from './model/assembly'

const systems = [...new Set(parts.map((part) => part.system))]

export default function App() {
  const [selectedId, setSelectedId] = useState('sidepod-left')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [isolatedId, setIsolatedId] = useState<string | null>(null)
  const [explode, setExplode] = useState(0)
  const [installedIds, setInstalledIds] = useState<string[]>(parts.map((part) => part.id))
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [tab, setTab] = useState<'component' | 'properties' | 'relations'>('component')
  const [notice, setNotice] = useState('SF-24 study reference loaded · reconstructed geometry')
  const geometryAssets = useGeometryAssets()
  const selected = parts.find((part) => part.id === selectedId) ?? parts[0]
  const hovered = parts.find((part) => part.id === hoveredId)
  const installed = installedIds.includes(selectedId)
  const blockers = installed ? getRemovalBlockers(selectedId, installedIds) : getInstallationBlockers(selectedId, installedIds)
  const assemblyErrors = validateInstalledSet(installedIds)
  const toggleInstalled = () => { if (blockers.length) { const nameOf = (id: string) => parts.find((part) => part.id === id)?.name ?? id; setNotice(installed ? 'Remove first, in order: ' + getRemovalSequence(selectedId, installedIds).map(nameOf).join(' → ') : 'Install first: ' + blockers.map(nameOf).join(', ')); return } setInstalledIds((current) => installed ? current.filter((id) => id !== selectedId) : [...current, selectedId]); setNotice(selected.name + (installed ? ' removed from study assembly' : ' installed in study assembly')) }
  const filtered = useMemo(() => parts.filter((part) => part.name.toLowerCase().includes(search.toLowerCase()) || part.system.toLowerCase().includes(search.toLowerCase())), [search])
  const toggleHidden = () => {
    setHiddenIds((current) => current.includes(selectedId) ? current.filter((id) => id !== selectedId) : [...current, selectedId])
    setNotice(hiddenIds.includes(selectedId) ? selected.name + ' shown' : selected.name + ' hidden')
    if (isolatedId) setIsolatedId(null)
  }
  const isolate = () => { setIsolatedId((current) => current === selectedId ? null : selectedId); setNotice(isolatedId === selectedId ? 'Isolation cleared' : selected.name + ' isolated') }
  const reset = () => { setExplode(0); setHiddenIds([]); setIsolatedId(null); setNotice('View reset · original transforms restored') }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span /></div><div><strong>TELAIO</strong><small>FORMULA ENGINEERING ENVIRONMENT</small></div></div>
      <nav className="main-nav"><button className="active"><Wrench size={15}/> Workbench</button><button><Box size={15}/> Assembly</button><button><Activity size={15}/> Simulation</button><button><SlidersHorizontal size={15}/> Analysis</button></nav>
      <div className="top-meta"><span className="model-tag">SF-24 STUDY / PUBLICLY INFORMED RECONSTRUCTION</span><button className="icon-button" aria-label="Help"><CircleHelp size={17}/></button><button className="icon-button" aria-label="Settings"><Settings2 size={17}/></button></div>
    </header>
    <section className="work-area">
      <aside className="panel explorer">
        <div className="panel-heading"><span>VEHICLE EXPLORER</span><span className="micro">{installedIds.length.toString().padStart(2, '0')} / {parts.length.toString().padStart(2, '0')} INSTALLED</span></div>
        <label className="search-box"><Search size={14}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components…"/></label>
        <div className="tree-root"><button className="tree-parent" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown/> : <ChevronRight/>}<Layers3 size={15}/> SF-24 study assembly</button>
          {expanded && <div className="tree-list">{systems.map((system) => <div className="system-group" key={system}><div className="system-label"><span className="tree-dot"/>{system}</div>{filtered.filter((part) => part.system.toLowerCase() === system.toLowerCase()).map((part) => <button key={part.id} className={'tree-item ' + (selectedId === part.id ? 'selected' : '')} onClick={() => { setSelectedId(part.id); setTab('component'); setNotice(part.name + ' selected') }}><span className="tree-indent"/><span className="part-square"/>{part.name}</button>)}</div>)}</div>}
        </div>
        <div className="panel-foot"><span className="status-dot"/> Semantic component IDs active</div>
      </aside>
      <section className="viewport-panel">
        <div className="viewport-toolbar"><div className="view-modes"><span className="mode-active">SOLID</span><span>3D ASSEMBLY</span><span>HOVER TO PREVIEW · CLICK TO SELECT</span></div><div className="viewport-actions"><button className="icon-button" onClick={isolate} title="Isolate selected"><Crosshair size={15}/></button><button className="icon-button" onClick={toggleHidden} title="Hide or show selected"><EyeOff size={15}/></button><button className="icon-button" onClick={reset} title="Reset view"><RotateCcw size={15}/></button><button className="icon-button" title="Viewport"><Maximize2 size={15}/></button></div></div>
        <div className="canvas-wrap"><AssemblyScene parts={parts} assets={geometryAssets.assets} selectedId={selectedId} hoveredId={hoveredId} hiddenIds={[...hiddenIds, ...parts.filter((part) => !installedIds.includes(part.id)).map((part) => part.id)]} isolatedId={isolatedId} explode={explode} onSelect={(id) => { setSelectedId(id); setTab('component'); setNotice((parts.find((part) => part.id === id)?.name ?? 'Component') + ' selected') }} onHover={setHoveredId}/></div>
        <div className="viewport-footer"><span><Crosshair size={12}/> SELECTED: {selected.id.toUpperCase()}</span><span>{hovered ? 'HOVER: ' + hovered.name.toUpperCase() : 'COORDINATES: STUDY FRAME · MODEL: STUDY-001'}</span></div>
      </section>
      <aside className="panel inspector">
        <div className="inspector-tabs"><button className={tab === 'component' ? 'active' : ''} onClick={() => setTab('component')}>COMPONENT</button><button className={tab === 'properties' ? 'active' : ''} onClick={() => setTab('properties')}>PROPERTIES</button><button className={tab === 'relations' ? 'active' : ''} onClick={() => setTab('relations')}>RELATIONS</button></div>
        <div className="inspector-content">
          <div className="component-kicker">{selected.system.toUpperCase()}</div><h1>{selected.name}</h1><p className="component-role">{selected.role}</p>
          {tab === 'component' && <><div className="part-preview"><div className="preview-wire"><Box size={42}/><span>GEOMETRY PREVIEW</span></div></div><div className="data-list"><div><span>Component ID</span><code>{selected.id}</code></div><div><span>Parent</span><strong>{selected.parent}</strong></div><div><span>Material</span><strong>{selected.material}</strong></div><div><span>Dimensions</span><strong>{selected.dimensions}</strong></div><div><span>Data status</span><b className="provenance">{provenanceLabel(selected.provenance).toUpperCase()}</b></div></div><div className="note-box"><ShieldCheck size={15}/><p>{selected.notes}</p></div></>}
          {tab === 'properties' && <div className="empty-state"><ShieldCheck size={22}/><strong>No verified engineering properties</strong><p>Mass, dimensions, stiffness and material properties remain unknown until traceable sources or measured inputs are supplied.</p></div>}
          {tab === 'relations' && <div className="data-list"><div><span>Parent assembly</span><strong>{selected.parent}</strong></div><div><span>System</span><strong>{selected.system}</strong></div><div><span>Interface records</span><strong>{interfaces.filter((edge) => edge.ownerId === selected.id).length}</strong></div>{interfaces.filter((edge) => edge.ownerId === selected.id).map((edge) => <div key={edge.id}><span>{edge.label}</span><strong>{parts.find((part) => part.id === edge.targetId)?.name ?? edge.targetId} · {edge.status}</strong></div>)}<div><span>Dependencies</span><strong>{(dependencies[selected.id] ?? []).map((id) => parts.find((part) => part.id === id)?.name ?? id).join(', ') || 'None'}</strong></div></div>}
          <div className="inspector-actions"><button onClick={toggleInstalled}><Wrench size={14}/> {installed ? 'Remove part' : 'Install part'}</button><button onClick={isolate}><Crosshair size={14}/> {isolatedId === selectedId ? 'Clear isolate' : 'Isolate'}</button><button onClick={toggleHidden}><Eye size={14}/> {hiddenIds.includes(selectedId) ? 'Show' : 'Hide'}</button></div>
        </div>
      </aside>
    </section>
    <section className="bottom-workspace">
      <div className="panel assembly-panel"><div className="panel-heading"><span>ASSEMBLY CONTROLS</span><span className="micro">TRANSFORM PREVIEW</span></div><div className="explode-control"><div><strong>Exploded separation</strong><span>Deterministic component offsets · reversible</span></div><output>{Math.round(explode * 100)}%</output></div><input className="range" type="range" min="0" max="1" step="0.01" value={explode} onChange={(e) => { setExplode(Number(e.target.value)); setNotice('Exploded transform updated') }} /><div className="control-footer"><span>ASSEMBLED</span><span>EXPLODED</span><button onClick={() => { setExplode(0); setNotice('Original transforms restored') }}>Reset transforms</button></div></div>
      <div className="panel analysis-panel"><div className="panel-heading"><span>ASSEMBLY MODEL INTEGRITY</span><span className="micro">{validateAssemblyModel().length === 0 && assemblyErrors.length === 0 ? 'VALID' : 'REVIEW'}</span></div><div className="policy-row"><span className="policy-mark unknown">?</span><div><strong>{validateAssemblyModel().length === 0 && assemblyErrors.length === 0 ? 'Assembly structure is consistent' : 'Assembly validation needs review'}</strong><p>{assemblyErrors.length === 0 && validateAssemblyModel().length === 0 ? 'Installed components satisfy the study prerequisite rules. Interface locations remain conceptual, not validated constraints.' : [...validateAssemblyModel(), ...assemblyErrors].join('; ')}</p></div></div><div className="policy-legend"><span><i/> SOURCED</span><span><i/> DERIVED</span><span><i/> ESTIMATED</span><span><i/> ILLUSTRATIVE</span><span><i/> UNKNOWN</span></div></div>
    </section>
    <footer className="statusbar"><span><span className="status-dot"/> READY</span><span>{notice}</span><span>SF-24 · ENGINEERING RECONSTRUCTION · GEOMETRY {geometryAssets.status.toUpperCase()}</span></footer>
  </main>
}
