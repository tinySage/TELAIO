import { useEffect, useMemo, useState } from 'react'
import { Activity, Axis3d, Box, ChevronDown, ChevronRight, CircleHelp, Crosshair, Eye, EyeOff, FlipHorizontal2, FileBox, Focus, Layers3, Link2, RotateCcw, Ruler, Save, Scissors, Search, Settings2, ShieldCheck, SlidersHorizontal, Trash2, Wrench, X } from 'lucide-react'
import AssemblyScene, { type FocusRequest } from './scene/AssemblyScene'
import AnalysisWorkspace from './ui/AnalysisWorkspace'
import SimulationWorkspace from './ui/SimulationWorkspace'
import { useGeometryAssets } from './scene/useGeometryAssets'
import { parts, provenanceLabel, type Vec3 } from './model/components'
import { dependencies, interfaces, relationsFor, validateAssemblyModel, getRemovalBlockers, getRemovalSequence, getInstallationBlockers, validateInstalledSet } from './model/assembly'
import { addMeasurePoint, AXES, INTERFACE_COLOURS, interfaceLinks, clampSectionOffset, describeMeasurement, SECTION_RANGE, STUDY_UNITS, type MeasureMode, type SectionSettings } from './model/cad'
import { parseViewStates, restoreErrors, upsertViewState, VIEW_STATE_STORAGE_KEY, type ViewState } from './model/viewStates'

const systems = [...new Set(parts.map((part) => part.system))]
const nameOf = (id: string) => parts.find((part) => part.id === id)?.name ?? id
const systemOf = (id: string) => parts.find((part) => part.id === id)?.system
const partsById = new Map(parts.map((part) => [part.id, part]))
const fmt3 = (value: number) => value.toFixed(3)

function readStoredStates() {
  try { return parseViewStates(localStorage.getItem(VIEW_STATE_STORAGE_KEY)) } catch { return { states: [], warnings: ['Browser storage is unavailable; saved states will not persist'] } }
}

type View = 'workbench' | 'analysis' | 'simulation'

export default function App() {
  const [view, setView] = useState<View>('workbench')
  const [selectedId, setSelectedId] = useState('sidepod-left')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [isolatedId, setIsolatedId] = useState<string | null>(null)
  const [explode, setExplode] = useState(0)
  const [installedIds, setInstalledIds] = useState<string[]>(parts.map((part) => part.id))
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [openSystems, setOpenSystems] = useState<string[]>(() => [systemOf('sidepod-left') ?? ''])
  const [tab, setTab] = useState<'component' | 'properties' | 'relations'>('component')
  const [section, setSection] = useState<SectionSettings | null>(null)
  const [measureMode, setMeasureMode] = useState<MeasureMode>('off')
  const [measurePoints, setMeasurePoints] = useState<Vec3[]>([])
  const [showFrames, setShowFrames] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const [proceduralIds, setProceduralIds] = useState<string[]>([])
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const [stored] = useState(readStoredStates)
  const [viewStates, setViewStates] = useState<ViewState[]>(stored.states)
  const [stateName, setStateName] = useState('')
  const [notice, setNotice] = useState(stored.warnings[0] ?? 'SF-24 study reference loaded · reconstructed geometry')
  const geometryAssets = useGeometryAssets()
  const selected = parts.find((part) => part.id === selectedId) ?? parts[0]
  const hovered = parts.find((part) => part.id === hoveredId)
  const installed = installedIds.includes(selectedId)
  const blockers = installed ? getRemovalBlockers(selectedId, installedIds) : getInstallationBlockers(selectedId, installedIds)
  const assemblyErrors = validateInstalledSet(installedIds)
  const modelErrors = useMemo(() => validateAssemblyModel(), [])
  const measurement = describeMeasurement(measureMode, measurePoints)
  const effectiveHidden = [...hiddenIds, ...parts.filter((part) => !installedIds.includes(part.id)).map((part) => part.id)]
  const visibleInScene = (id: string) => !effectiveHidden.includes(id) && (!isolatedId || isolatedId === id)
  const links = showLinks ? interfaceLinks(selectedId, partsById, interfaces, explode, (id) => !effectiveHidden.includes(id)) : []
  const sceneAssets = useMemo(() => Object.fromEntries(Object.entries(geometryAssets.assets).filter(([id]) => !proceduralIds.includes(id))), [geometryAssets.assets, proceduralIds])
  const assetEntry = geometryAssets.entries[selectedId]
  const loadedAsset = geometryAssets.assets[selectedId]
  const usingProcedural = proceduralIds.includes(selectedId)
  const relations = relationsFor(selectedId)

  const select = (id: string, from: 'tree' | 'viewport') => {
    setSelectedId(id); setTab('component'); setNotice(nameOf(id) + ' selected')
    const system = systemOf(id)
    if (from === 'viewport' && system) setOpenSystems((current) => current.includes(system) ? current : [...current, system])
  }
  const toggleInstalled = () => { if (blockers.length) { setNotice(installed ? 'Remove first, in order: ' + getRemovalSequence(selectedId, installedIds).map(nameOf).join(' → ') : 'Install first: ' + blockers.map(nameOf).join(', ')); return } setInstalledIds((current) => installed ? current.filter((id) => id !== selectedId) : [...current, selectedId]); setNotice(selected.name + (installed ? ' removed from study assembly' : ' installed in study assembly')) }
  const filtered = useMemo(() => parts.filter((part) => part.name.toLowerCase().includes(search.toLowerCase()) || part.system.toLowerCase().includes(search.toLowerCase()) || part.id.includes(search.toLowerCase())), [search])
  const toggleHidden = () => {
    setHiddenIds((current) => current.includes(selectedId) ? current.filter((id) => id !== selectedId) : [...current, selectedId])
    setNotice(hiddenIds.includes(selectedId) ? selected.name + ' shown' : selected.name + ' hidden')
    if (isolatedId) setIsolatedId(null)
  }
  const isolate = () => { setIsolatedId((current) => current === selectedId ? null : selectedId); setNotice(isolatedId === selectedId ? 'Isolation cleared' : selected.name + ' isolated') }
  const reset = () => { setExplode(0); setHiddenIds([]); setIsolatedId(null); setSection(null); setMeasureMode('off'); setMeasurePoints([]); setNotice('View reset · original transforms restored') }
  const focus = () => { setFocusRequest({ id: selectedId, nonce: Date.now() }); setNotice('Camera focused on ' + selected.name) }
  const toggleSection = () => { setSection((current) => current ? null : { axis: 'z', offset: 0, flip: true }); setNotice(section ? 'Section view off' : 'Section view on · centreline cut') }
  const setMeasure = (mode: MeasureMode) => { setMeasureMode(mode); setMeasurePoints([]); setNotice(mode === 'off' ? 'Measurement off' : 'Measuring ' + mode + ' · click points on visible geometry') }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === 'INPUT') return
      if (event.key === 'Escape') { setMeasureMode('off'); setMeasurePoints([]) }
      if (event.key === 'f' || event.key === 'F') setFocusRequest({ id: selectedId, nonce: Date.now() })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const persist = (states: ViewState[]) => {
    setViewStates(states)
    try { localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(states)) } catch { setNotice('Browser storage is unavailable; saved states will not persist') }
  }
  const saveState = () => {
    const name = stateName.trim() || 'State ' + (viewStates.length + 1)
    persist(upsertViewState(viewStates, { name, savedAt: new Date().toISOString(), explode, hiddenIds, isolatedId, installedIds, section }))
    setStateName(''); setNotice('Saved state "' + name + '"')
  }
  const restoreState = (state: ViewState) => {
    const errors = restoreErrors(state)
    if (errors.length) { setNotice('Cannot restore "' + state.name + '": ' + errors.slice(0, 2).join('; ')); return }
    setExplode(state.explode); setHiddenIds(state.hiddenIds); setIsolatedId(state.isolatedId); setInstalledIds(state.installedIds); setSection(state.section)
    setNotice('Restored state "' + state.name + '"')
  }

  const searching = search.trim().length > 0
  const removedCount = parts.length - installedIds.length

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span /></div><div><strong>TELAIO</strong><small>FORMULA ENGINEERING ENVIRONMENT</small></div></div>
      <nav className="main-nav">
        <button className={view === 'workbench' ? 'active' : ''} onClick={() => setView('workbench')}><Wrench size={15}/> Workbench</button>
        <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}><SlidersHorizontal size={15}/> Analysis</button>
        <button className={view === 'simulation' ? 'active' : ''} onClick={() => setView('simulation')}><Activity size={15}/> Simulation</button>
        <button disabled title="Projects and revisions arrive in Phase 18"><Box size={15}/> Project</button>
      </nav>
      <div className="top-meta"><span className="model-tag">SF-24 STUDY / PUBLICLY INFORMED RECONSTRUCTION</span><button className="icon-button" aria-label="Help"><CircleHelp size={17}/></button><button className="icon-button" aria-label="Settings"><Settings2 size={17}/></button></div>
    </header>
    {/* Both views stay mounted so lab state and the loaded 3D scene survive switching. */}
    <div className={'view-pane' + (view === 'analysis' ? '' : ' view-hidden')}><AnalysisWorkspace parts={parts} installedIds={installedIds} onNotice={setNotice}/></div>
    <div className={'view-pane' + (view === 'simulation' ? '' : ' view-hidden')}><SimulationWorkspace active={view === 'simulation'} onNotice={setNotice}/></div>
    <div className={'view-pane' + (view === 'workbench' ? '' : ' view-hidden')}><section className="work-area">
      <aside className="panel explorer">
        <div className="panel-heading"><span>VEHICLE EXPLORER</span><span className="micro">{installedIds.length.toString().padStart(2, '0')} / {parts.length.toString().padStart(2, '0')} INSTALLED</span></div>
        <label className="search-box"><Search size={14}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components…"/></label>
        <div className="tree-root"><button className="tree-parent" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown/> : <ChevronRight/>}<Layers3 size={15}/> SF-24 study assembly</button>
          {expanded && <div className="tree-list">{systems.map((system) => {
            const members = parts.filter((part) => part.system === system)
            const shown = filtered.filter((part) => part.system === system)
            if (searching && shown.length === 0) return null
            const open = searching || openSystems.includes(system)
            return <div className="system-group" key={system}>
              <button className="system-label" aria-expanded={open} onClick={() => setOpenSystems((current) => current.includes(system) ? current.filter((item) => item !== system) : [...current, system])}>{open ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}{system}<span className="system-count">{members.filter((part) => installedIds.includes(part.id)).length}/{members.length}</span></button>
              {open && shown.map((part) => {
                const removed = !installedIds.includes(part.id), hidden = hiddenIds.includes(part.id)
                return <button key={part.id} className={'tree-item ' + (selectedId === part.id ? 'selected ' : '') + (removed ? 'removed' : '')} onClick={() => select(part.id, 'tree')} title={removed ? 'Removed from study assembly' : undefined}><span className="tree-indent"/><span className="part-square"/><span className="tree-name">{part.name}</span>{hidden && <EyeOff size={11} className="tree-flag"/>}{removed && <span className="tree-flag removed-flag">OUT</span>}</button>
              })}
            </div>
          })}</div>}
        </div>
        <div className="panel-foot"><span className="status-dot"/> {systems.length} systems · {removedCount ? removedCount + ' removed' : 'all installed'}</div>
      </aside>
      <section className="viewport-panel">
        <div className="viewport-toolbar"><div className="view-modes"><span className="mode-active">SOLID</span>{section && <span className="mode-active">SECTION {section.axis.toUpperCase()}</span>}{measureMode !== 'off' && <span className="mode-active">MEASURE · {measureMode.toUpperCase()}</span>}<span className="hint">{measureMode !== 'off' ? 'CLICK POINTS · ESC TO EXIT' : 'HOVER TO PREVIEW · CLICK TO SELECT · F TO FOCUS'}</span></div>
          <div className="viewport-actions">
            <button className={'icon-button ' + (section ? 'on' : '')} onClick={toggleSection} title="Section view" aria-pressed={!!section}><Scissors size={15}/></button>
            <button className={'icon-button ' + (measureMode !== 'off' ? 'on' : '')} onClick={() => setMeasure(measureMode === 'off' ? 'distance' : 'off')} title="Measure distance or angle" aria-pressed={measureMode !== 'off'}><Ruler size={15}/></button>
            <button className={'icon-button ' + (showFrames ? 'on' : '')} onClick={() => { setShowFrames(!showFrames); setNotice(showFrames ? 'Coordinate frames hidden' : 'Study frame and selected part frame shown') }} title="Coordinate frames" aria-pressed={showFrames}><Axis3d size={15}/></button>
            <button className={'icon-button ' + (showLinks ? 'on' : '')} onClick={() => { setShowLinks(!showLinks); setNotice(showLinks ? 'Interface links hidden' : 'Showing interface links for ' + selected.name) }} title="Interface links of selected part" aria-pressed={showLinks}><Link2 size={15}/></button>
            <span className="tool-divider"/>
            <button className="icon-button" onClick={focus} title="Focus selected (F)"><Focus size={15}/></button>
            <button className="icon-button" onClick={isolate} title="Isolate selected"><Crosshair size={15}/></button>
            <button className="icon-button" onClick={toggleHidden} title="Hide or show selected"><EyeOff size={15}/></button>
            <button className="icon-button" onClick={reset} title="Reset view"><RotateCcw size={15}/></button>
          </div>
        </div>
        {section && <div className="tool-strip">
          <span className="strip-label">SECTION</span>
          <div className="segmented">{AXES.map((axis) => <button key={axis} className={section.axis === axis ? 'active' : ''} onClick={() => setSection({ ...section, axis, offset: clampSectionOffset(axis, axis === 'z' ? 0 : section.offset) })}>{axis.toUpperCase()}</button>)}</div>
          <input className="range strip-range" type="range" aria-label="Section offset" min={SECTION_RANGE[section.axis][0]} max={SECTION_RANGE[section.axis][1]} step="0.005" value={section.offset} onChange={(e) => setSection({ ...section, offset: Number(e.target.value) })}/>
          <output className="strip-value">{section.axis} = {section.offset.toFixed(3)}</output>
          <button className="strip-button" onClick={() => setSection({ ...section, flip: !section.flip })} title="Keep the other side"><FlipHorizontal2 size={13}/> Flip</button>
        </div>}
        <div className="canvas-wrap">
          <AssemblyScene parts={parts} assets={sceneAssets} selectedId={selectedId} hoveredId={hoveredId} hiddenIds={effectiveHidden} isolatedId={isolatedId} explode={explode}
            section={section} measureMode={measureMode} measurePoints={measurePoints} showFrames={showFrames} focusRequest={focusRequest} links={links}
            onSelect={(id) => select(id, 'viewport')} onHover={setHoveredId} onMeasurePoint={(point) => setMeasurePoints((current) => addMeasurePoint(measureMode, current, point))}/>
          {measurement && <div className="measure-card" role="status">
            <div className="measure-head"><div className="segmented">{(['distance', 'angle'] as const).map((mode) => <button key={mode} className={measureMode === mode ? 'active' : ''} onClick={() => setMeasure(mode)}>{mode.toUpperCase()}</button>)}</div><button className="icon-button small" onClick={() => setMeasure('off')} aria-label="Close measurement"><X size={13}/></button></div>
            <strong className={measurement.complete ? 'measure-value' : 'measure-prompt'}>{measurement.value}</strong>
            {measurement.detail && <span className="measure-detail">{measurement.detail}</span>}
            <span className="measure-note">Dimensionless study frame · {STUDY_UNITS}, not physical dimensions</span>
          </div>}
        </div>
        <div className="viewport-footer"><span><Crosshair size={12}/> SELECTED: {selected.id.toUpperCase()}</span><span>{hovered ? 'HOVER: ' + hovered.name.toUpperCase() : 'COORDINATES: STUDY FRAME · X FWD · Y UP · Z LEFT'}</span></div>
        {showLinks && <div className="link-legend">{Object.entries(INTERFACE_COLOURS).map(([type, colour]) => <span key={type}><i style={{ background: colour }}/>{type}</span>)}<span className="link-count">{links.length} OF {relations.outgoing.length + relations.incoming.length} VISIBLE</span></div>}
      </section>
      <aside className="panel inspector">
        <div className="inspector-tabs"><button className={tab === 'component' ? 'active' : ''} onClick={() => setTab('component')}>COMPONENT</button><button className={tab === 'properties' ? 'active' : ''} onClick={() => setTab('properties')}>PROPERTIES</button><button className={tab === 'relations' ? 'active' : ''} onClick={() => setTab('relations')}>RELATIONS</button></div>
        <div className="inspector-content">
          <div className="component-kicker">{selected.system.toUpperCase()}</div><h1>{selected.name}</h1><p className="component-role">{selected.role}</p>
          {tab === 'component' && <><div className="geometry-block">
            <div className="geometry-head"><FileBox size={14}/><strong>Geometry</strong><span className={'geometry-source ' + (assetEntry && !usingProcedural ? 'imported' : '')}>{assetEntry && !usingProcedural ? (loadedAsset ? 'IMPORTED ASSET' : 'ASSET NOT LOADED') : 'PROCEDURAL ENVELOPE'}</span></div>
            {assetEntry ? <div className="data-list compact">
              <div><span>Asset</span><code>{assetEntry.assetUri}</code></div>
              <div><span>Asset revision</span><code>{assetEntry.revision}</code></div>
              <div><span>Integrity</span><code title={assetEntry.integrity?.sha256}>{assetEntry.integrity ? 'sha256 ' + assetEntry.integrity.sha256.slice(0, 12) + '… · rev ' + assetEntry.integrity.revision : 'UNRECORDED'}</code></div>
              <div><span>Units · provenance</span><strong>{assetEntry.units} · {assetEntry.provenance}</strong></div>
              {loadedAsset && <div><span>Mesh data</span><strong>{loadedAsset.meshCount} meshes · {loadedAsset.triangleCount.toLocaleString()} triangles</strong></div>}
              {loadedAsset && <div><span>Extent (asset units)</span><code>{(['x', 'y', 'z'] as const).map((axis) => fmt3(loadedAsset.bounds.max[axis] - loadedAsset.bounds.min[axis])).join(' × ')}</code></div>}
              <div><span>Licence record</span><strong className="wrap">{assetEntry.licence.spdxId ?? assetEntry.licence.permissionRecord}</strong></div>
            </div> : <p className="geometry-note">No asset registered. Rendered from the procedural <code>{selected.shape}</code> envelope in the component model.</p>}
            {assetEntry && <button className="strip-button geometry-toggle" onClick={() => { setProceduralIds((current) => usingProcedural ? current.filter((id) => id !== selectedId) : [...current, selectedId]); setNotice(selected.name + (usingProcedural ? ': imported asset restored' : ': procedural envelope shown for comparison')) }}>{usingProcedural ? 'Use imported asset' : 'Compare with procedural envelope'}</button>}
          </div><div className="data-list"><div><span>Component ID</span><code>{selected.id}</code></div><div><span>Parent</span><strong>{selected.parent}</strong></div><div><span>Material</span><strong>{selected.material}</strong></div><div><span>Dimensions</span><strong>{selected.dimensions}</strong></div><div><span>Data status</span><b className="provenance">{provenanceLabel(selected.provenance).toUpperCase()}</b></div></div><div className="note-box"><ShieldCheck size={15}/><p>{selected.notes}</p></div></>}
          {tab === 'properties' && <div className="empty-state"><ShieldCheck size={22}/><strong>No verified engineering properties</strong><p>Mass, dimensions, stiffness and material properties remain unknown until traceable sources or measured inputs are supplied.</p></div>}
          {tab === 'relations' && <>
            <div className="data-list compact"><div><span>Parent assembly</span><strong>{selected.parent}</strong></div><div><span>System</span><strong>{selected.system}</strong></div><div><span>Dependencies</span><strong className="wrap">{(dependencies[selected.id] ?? []).map(nameOf).join(', ') || 'None'}</strong></div></div>
            {([['outgoing', 'INTERFACES DECLARED BY THIS PART'], ['incoming', 'INTERFACES DECLARED ONTO THIS PART']] as const).map(([direction, title]) => <div key={direction} className="relation-group">
              <div className="relation-title">{title}<span>{relations[direction].length}</span></div>
              {relations[direction].length === 0 ? <p className="geometry-note">None</p> : relations[direction].map((edge) => { const otherId = direction === 'outgoing' ? edge.targetId : edge.ownerId; return <button key={edge.id} className={'relation-row ' + (visibleInScene(otherId) ? '' : 'dim')} onClick={() => select(otherId, 'viewport')} onMouseEnter={() => setHoveredId(otherId)} onMouseLeave={() => setHoveredId(null)} title={'Select ' + nameOf(otherId)}>
                <i style={{ background: INTERFACE_COLOURS[edge.type] }}/><span className="relation-text"><strong>{edge.label}</strong><span>{direction === 'outgoing' ? '→ ' : '← '}{nameOf(otherId)}</span></span><code>{edge.type}</code></button> })}
            </div>)}
            <p className="geometry-note">All interfaces are {interfaces.every((edge) => edge.status === 'CONCEPTUAL') ? 'CONCEPTUAL' : 'mixed status'}: they record which parts meet, not validated constraint geometry.</p>
          </>}
          <div className="inspector-actions"><button onClick={toggleInstalled}><Wrench size={14}/> {installed ? 'Remove part' : 'Install part'}</button><button onClick={isolate}><Crosshair size={14}/> {isolatedId === selectedId ? 'Clear isolate' : 'Isolate'}</button><button onClick={toggleHidden}><Eye size={14}/> {hiddenIds.includes(selectedId) ? 'Show' : 'Hide'}</button></div>
        </div>
      </aside>
    </section>
    <section className="bottom-workspace">
      <div className="panel assembly-panel"><div className="panel-heading"><span>ASSEMBLY CONTROLS</span><span className="micro">TRANSFORM PREVIEW</span></div><div className="explode-control"><div><strong>Exploded separation</strong><span>Deterministic component offsets · reversible</span></div><output>{Math.round(explode * 100)}%</output></div><input className="range" type="range" aria-label="Exploded separation" min="0" max="1" step="0.01" value={explode} onChange={(e) => { setExplode(Number(e.target.value)); setNotice('Exploded transform updated') }} /><div className="control-footer"><span>ASSEMBLED</span><span>EXPLODED</span><button onClick={() => { setExplode(0); setNotice('Original transforms restored') }}>Reset transforms</button></div></div>
      <div className="panel states-panel"><div className="panel-heading"><span>SAVED STATES</span><span className="micro">{viewStates.length} STORED · THIS BROWSER</span></div>
        <form className="state-save" onSubmit={(event) => { event.preventDefault(); saveState() }}><input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="Name this state…" maxLength={60} aria-label="State name"/><button type="submit"><Save size={13}/> Save</button></form>
        <div className="state-list">{viewStates.length === 0 ? <p className="state-empty">Saves explode, visibility, installed parts and section. Camera pose is not saved.</p> : viewStates.map((state) => <div className="state-row" key={state.name}><button className="state-restore" onClick={() => restoreState(state)} title={'Restore ' + state.name}><strong>{state.name}</strong><span>{Math.round(state.explode * 100)}% · {state.installedIds.length}/{parts.length}{state.section ? ' · section ' + state.section.axis : ''}</span></button><button className="icon-button small" onClick={() => { persist(viewStates.filter((item) => item.name !== state.name)); setNotice('Deleted state "' + state.name + '"') }} aria-label={'Delete ' + state.name}><Trash2 size={12}/></button></div>)}</div>
      </div>
      <div className="panel analysis-panel"><div className="panel-heading"><span>ASSEMBLY MODEL INTEGRITY</span><span className="micro">{modelErrors.length === 0 && assemblyErrors.length === 0 ? 'VALID' : 'REVIEW'}</span></div><div className="policy-row"><span className="policy-mark unknown">?</span><div><strong>{modelErrors.length === 0 && assemblyErrors.length === 0 ? 'Assembly structure is consistent' : 'Assembly validation needs review'}</strong><p>{assemblyErrors.length === 0 && modelErrors.length === 0 ? 'Installed components satisfy the study prerequisite rules. Interface locations remain conceptual, not validated constraints.' : [...modelErrors, ...assemblyErrors].join('; ')}</p></div></div><div className="policy-legend"><span><i/> SOURCED</span><span><i/> DERIVED</span><span><i/> ESTIMATED</span><span><i/> ILLUSTRATIVE</span><span><i/> UNKNOWN</span></div></div>
    </section>
    </div>
    <footer className="statusbar"><span><span className="status-dot"/> READY</span><span>{notice}</span><span>SF-24 · ENGINEERING RECONSTRUCTION · GEOMETRY {geometryAssets.status.toUpperCase()}</span></footer>
  </main>
}
