/**
 * Design workspace: parametric CAD on the study model.
 *  - Parameters: named expressions that drive every dimension.
 *  - Features: sketch a profile on a plane, then extrude or revolve it into a solid.
 *  - Hardpoints: drag suspension pickup points in 3D; kinematics update live and the Suspension lab follows.
 *  - Drafting: side, top and front drawings with snapping, dimensions and a command line.
 */
import { useCallback, useMemo, useState } from 'react'
import { Box, Eye, EyeOff, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import type { Part } from '../model/components'
import { parseDesign, DESIGN_STORAGE_KEY, emptyDesign, exampleDesign, newId, type Design } from '../cad/design'
import { resolveDesign, SKETCH_PLANES, type Feature, type P2, type Profile, type ResolvedFeature } from '../cad/solids'
import { NAME_PATTERN } from '../cad/expr'
import type { DraftView, Annotation } from '../cad/drafting'
import { summarise } from '../engineering/suspension'
import DesignScene from './DesignScene'
import DraftingView from './DraftingView'
import { defaults as suspensionDefaults, loadSuspension, pointLabel, POINTS, SUSPENSION_KEY, type Corner, type Stored as SuspensionStore } from './SuspensionLab'
import { fmt, ProvenanceBadge, ResultRow, storage, useStorageSubscription } from './engineeringUi'

type Tab = 'features' | 'parameters' | 'hardpoints'

const NEW_FEATURES: { label: string; make: () => Omit<Feature, 'id'> }[] = [
  { label: 'Extruded rectangle', make: () => ({ name: 'Extruded rectangle', plane: 'XY', offset: '0', visible: true, profile: { kind: 'rect', cu: '0', cv: '0.6', width: '0.3', height: '0.2' }, op: { kind: 'extrude', depth: '0.1', symmetric: true } }) },
  { label: 'Extruded circle', make: () => ({ name: 'Extruded circle', plane: 'XY', offset: '0', visible: true, profile: { kind: 'circle', cu: '0', cv: '0.6', radius: '0.1' }, op: { kind: 'extrude', depth: '0.2', symmetric: true } }) },
  { label: 'Extruded polygon', make: () => ({ name: 'Extruded profile', plane: 'XY', offset: '0', visible: true, profile: { kind: 'polygon', points: [['0', '0.5'], ['0.4', '0.5'], ['0.3', '0.7']] }, op: { kind: 'extrude', depth: '0.05', symmetric: true } }) },
  { label: 'Revolved profile', make: () => ({ name: 'Revolved profile', plane: 'XY', offset: '0', visible: true, profile: { kind: 'polygon', points: [['0', '0.05'], ['0.3', '0.05'], ['0.3', '0.12'], ['0', '0.08']] }, op: { kind: 'revolve', axis: 'u', angle: '360' } }) },
]

export default function DesignWorkspace({ parts, onNotice }: { parts: Part[]; onNotice: (t: string) => void }) {
  const [design, setDesign] = useState<Design>(() => parseDesign(storage.read(DESIGN_STORAGE_KEY)))
  const [suspension, setSuspension] = useState<SuspensionStore>(loadSuspension)
  useStorageSubscription(SUSPENSION_KEY, useCallback(() => setSuspension(loadSuspension()), []))
  const [tab, setTab] = useState<Tab>('features')
  const [mode, setMode] = useState<'3d' | 'drafting'>('3d')
  const [draftView, setDraftView] = useState<DraftView>('side')
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  const [corner, setCorner] = useState<Corner>('front')
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [showGhost, setShowGhost] = useState(true)

  const save = (next: Design) => { setDesign(next); storage.write(DESIGN_STORAGE_KEY, next) }
  const resolved = useMemo(() => resolveDesign(design), [design])
  const feature = design.features.find((f) => f.id === selectedFeature) ?? null
  const rFeature = resolved.features.find((f) => f.id === selectedFeature) ?? null
  const updateFeature = (patch: Partial<Feature>) => feature && save({ ...design, features: design.features.map((f) => f.id === feature.id ? { ...f, ...patch } : f) })

  const saveSuspension = (next: SuspensionStore) => { setSuspension(next); storage.write(SUSPENSION_KEY, next) }
  const h = suspension.hardpoints[corner]
  const kin = useMemo(() => summarise(h, suspension.provenance[corner], suspension.springs[corner]), [h, suspension, corner])
  const movePoint = (index: number, v: [number, number, number]) => saveSuspension({ ...suspension, hardpoints: { ...suspension.hardpoints, [corner]: POINTS[index].set(h, v) } })
  const corners = useMemo(() => [suspension.hardpoints.front, suspension.hardpoints.rear], [suspension.hardpoints])
  const onAnnotations = useCallback((next: Annotation[]) => save({ ...design, drawings: { ...design.drawings, [draftView]: next } }), [design, draftView]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectFeature = (id: string | null) => { setSelectedFeature(id); if (id) { setSelectedPoint(null); setTab('features') } }
  const selectPoint = (i: number | null) => { setSelectedPoint(i); if (i !== null) { setSelectedFeature(null); setTab('hardpoints') } }

  return <section className="workspace design">
    <div className="design-grid">
      <aside className="lab-column design-left">
        <div className="segmented design-tabs">{(['features', 'parameters', 'hardpoints'] as Tab[]).map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t.toUpperCase()}</button>)}</div>
        {tab === 'features' && <>
          <div className="lab-subhead"><span>FEATURE TREE</span><span>{design.features.length}</span></div>
          {design.features.length === 0 && <p className="lab-hint">No solids yet. Add a feature below, or load the worked example to see parameters driving several features.</p>}
          {resolved.features.map((f) => <div key={f.id} className={'feature-row' + (f.id === selectedFeature ? ' selected' : '')}>
            <button className="feature-main" onClick={() => selectFeature(f.id)}><strong>{f.name}</strong><span>{f.op?.kind === 'revolve' ? 'Revolve' : 'Extrude'} · {f.plane} · {f.issues.length ? <em>{f.issues.length} issue(s)</em> : fmt(f.volume!, 4) + ' su³'}</span></button>
            <button className="icon-button small" aria-label={(f.visible ? 'Hide ' : 'Show ') + f.name} onClick={() => save({ ...design, features: design.features.map((x) => x.id === f.id ? { ...x, visible: !x.visible } : x) })}>{f.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>
            <button className="icon-button small" aria-label={'Delete ' + f.name} onClick={() => { save({ ...design, features: design.features.filter((x) => x.id !== f.id) }); if (selectedFeature === f.id) setSelectedFeature(null) }}><Trash2 size={12}/></button>
          </div>)}
          <div className="lab-subhead"><span>NEW FEATURE</span></div>
          <div className="new-features">{NEW_FEATURES.map((n) => <button key={n.label} className="mini" onClick={() => { const f = { id: newId('f'), ...n.make() }; save({ ...design, features: [...design.features, f] }); selectFeature(f.id); onNotice(n.label + ' added') }}><Plus size={11}/> {n.label}</button>)}</div>
          <div className="lab-toolbar">
            <button onClick={() => { save({ ...exampleDesign(), drawings: design.drawings }); setSelectedFeature(null); onNotice('Example design loaded: parameters drive the endplate, nut and spacer') }}><Sparkles size={12}/> Load example</button>
            <button onClick={() => { save(emptyDesign()); setSelectedFeature(null); onNotice('Design cleared') }}><RotateCcw size={12}/> Clear design</button>
          </div>
        </>}
        {tab === 'parameters' && <Parameters design={design} resolved={resolved} save={save}/>}
        {tab === 'hardpoints' && <>
          <div className="segmented">{(['front', 'rear'] as Corner[]).map((c) => <button key={c} className={corner === c ? 'active' : ''} onClick={() => { setCorner(c); setSelectedPoint(null) }}>{c.toUpperCase()} LEFT</button>)}</div>
          <p className="lab-hint">Click a point here or in the 3D view, then drag the arrows. The right side mirrors the left. Same data as the Suspension lab.</p>
          <div className="point-list">{POINTS.map((p, i) => <button key={p.key} className={'point-row' + (selectedPoint === i ? ' selected' : '')} onClick={() => { selectPoint(i); setMode('3d') }}><span>{pointLabel(h, i)}</span><code>{p.get(h).map((v) => v.toFixed(3)).join(', ')}</code></button>)}</div>
          <div className="lab-toolbar"><button onClick={() => { saveSuspension({ ...suspension, hardpoints: { ...suspension.hardpoints, [corner]: suspensionDefaults().hardpoints[corner] }, provenance: { ...suspension.provenance, [corner]: 'ILLUSTRATIVE' } }); onNotice('Hardpoints reset to the illustrative default') }}><RotateCcw size={12}/> Reset {corner}</button></div>
        </>}
      </aside>

      <section className="design-centre">
        <div className="viewport-toolbar">
          <div className="segmented"><button className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>3D MODEL</button><button className={mode === 'drafting' ? 'active' : ''} onClick={() => setMode('drafting')}>2D DRAFTING</button></div>
          {mode === '3d' && <div className="viewport-actions"><span className="hint">{selectedPoint !== null ? 'DRAG THE ARROWS TO MOVE THE HARDPOINT' : 'CLICK A SOLID OR HARDPOINT TO EDIT'}</span>
            <button className={'icon-button ' + (showGhost ? 'on' : '')} title="Show the study car" aria-pressed={showGhost} onClick={() => setShowGhost(!showGhost)}><Box size={15}/></button></div>}
        </div>
        <div className="canvas-wrap design-canvas">
          {mode === '3d' ? <DesignScene parts={parts} features={resolved.features} selectedFeature={selectedFeature} onSelectFeature={selectFeature} showGhost={showGhost}
            hardpoints={{ corners: suspension.hardpoints, activeCorner: corner, selectedPoint, onSelectPoint: selectPoint, onMovePoint: movePoint }}/>
            : <DraftingView parts={parts} features={resolved.features} corners={corners} view={draftView} onView={setDraftView} annotations={design.drawings[draftView]} onAnnotations={onAnnotations} onNotice={onNotice}/>}
        </div>
      </section>

      <aside className="lab-column design-right">
        {selectedPoint !== null ? <>
          <div className="lab-subhead"><span>HARDPOINT · {corner.toUpperCase()} LEFT</span><ProvenanceBadge value={suspension.provenance[corner]}/></div>
          <strong className="inspector-title">{pointLabel(h, selectedPoint)}</strong>
          <div className="xyz-row">{(['x', 'y', 'z'] as const).map((axis, k) => <label key={axis}>{axis} <input type="number" step="0.005" aria-label={'Hardpoint ' + axis} value={POINTS[selectedPoint].get(h)[k]} onChange={(e) => { const v = [...POINTS[selectedPoint].get(h)] as [number, number, number]; v[k] = Number(e.target.value); movePoint(selectedPoint, v) }}/></label>)}</div>
          <div className="lab-subhead"><span>LIVE KINEMATICS</span></div>
          {kin.staticState ? <div className="results">
            <ResultRow label="Camber gain" result={kin.camberGain} format={(v: number) => fmt(v, 2)}/>
            <ResultRow label="Bump steer" result={kin.toeGain} format={(v: number) => fmt(v, 3)}/>
            <ResultRow label="Roll centre height" result={kin.rollCentre} format={(v: number) => fmt(v, 3)}/>
            <ResultRow label="Rod motion ratio" result={kin.motionRatio} format={(v: number) => fmt(v, 3)}/>
          </div> : <p className="issues"><span>The linkage does not close with this point. Move it back or reset the corner.</span></p>}
          <p className="lab-hint">Rigid-link solve at static, same solver as the Suspension lab. Values take the hardpoint set's provenance; dragging does not make them measured.</p>
        </> : feature && rFeature ? <FeatureInspector feature={feature} resolved={rFeature} update={updateFeature}/> : <div className="empty-state"><strong>Nothing selected</strong><p>Select a feature to edit its sketch and operation, or a suspension hardpoint to move it with live kinematics.</p></div>}
      </aside>
    </div>
  </section>
}

function Parameters({ design, resolved, save }: { design: Design; resolved: ReturnType<typeof resolveDesign>; save: (d: Design) => void }) {
  const set = (i: number, patch: Partial<Design['params'][number]>) => save({ ...design, params: design.params.map((p, j) => j === i ? { ...p, ...patch } : p) })
  return <>
    <div className="lab-subhead"><span>PARAMETERS</span><span>NAME · EXPRESSION · VALUE</span></div>
    <p className="lab-hint">Any dimension can use these names, e.g. <code>plate_len * 0.6</code>. Functions: sqrt abs min max sin cos tan (degrees), pi.</p>
    {design.params.map((p, i) => <div key={i} className="param-row">
      <input aria-label={'Parameter ' + (i + 1) + ' name'} value={p.name} className={NAME_PATTERN.test(p.name) ? '' : 'bad'} onChange={(e) => set(i, { name: e.target.value })}/>
      <input aria-label={'Parameter ' + (i + 1) + ' expression'} value={p.expr} onChange={(e) => set(i, { expr: e.target.value })}/>
      <code title={resolved.params.errors[p.name]} className={resolved.params.errors[p.name] ? 'bad' : ''}>{resolved.params.errors[p.name] ? 'error' : fmt(resolved.params.values[p.name], 4)}</code>
      <button className="icon-button small" aria-label={'Delete parameter ' + p.name} onClick={() => save({ ...design, params: design.params.filter((_, j) => j !== i) })}><Trash2 size={11}/></button>
      {resolved.params.errors[p.name] && <span className="param-error">{resolved.params.errors[p.name]}</span>}
    </div>)}
    <div className="lab-toolbar"><button onClick={() => { let n = design.params.length + 1; while (design.params.some((p) => p.name === 'p' + n)) n++; save({ ...design, params: [...design.params, { name: 'p' + n, expr: '0.1' }] }) }}><Plus size={12}/> Add parameter</button></div>
  </>
}

function Expr({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="expr-field"><span>{label}</span><input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}/></label>
}

function FeatureInspector({ feature, resolved, update }: { feature: Feature; resolved: ResolvedFeature; update: (p: Partial<Feature>) => void }) {
  const p = feature.profile
  const setProfile = (profile: Profile) => update({ profile })
  return <>
    <div className="lab-subhead"><span>FEATURE</span><span>{feature.op.kind.toUpperCase()}</span></div>
    <input className="lab-name" aria-label="Feature name" value={feature.name} onChange={(e) => update({ name: e.target.value })}/>
    <div className="lab-subhead"><span>SKETCH</span></div>
    <label className="expr-field"><span>Plane</span><select aria-label="Sketch plane" value={feature.plane} onChange={(e) => update({ plane: e.target.value as Feature['plane'] })}>{SKETCH_PLANES.map((pl) => <option key={pl} value={pl}>{pl} · {({ XY: 'u=x v=y', YZ: 'u=y v=z', ZX: 'u=z v=x' })[pl]}</option>)}</select></label>
    <Expr label="Plane offset" value={feature.offset} onChange={(offset) => update({ offset })}/>
    <label className="expr-field"><span>Profile</span><select aria-label="Profile type" value={p.kind} onChange={(e) => {
      const k = e.target.value as Profile['kind']
      const poly: [string, string][] = resolved.polygon.length >= 3 ? resolved.polygon.map(([u, v]) => [String(+u.toFixed(4)), String(+v.toFixed(4))]) : [['0', '0'], ['0.2', '0'], ['0.1', '0.2']]
      setProfile(k === 'rect' ? { kind: 'rect', cu: '0', cv: '0', width: '0.2', height: '0.1' } : k === 'circle' ? { kind: 'circle', cu: '0', cv: '0', radius: '0.1' } : { kind: 'polygon', points: k === p.kind ? (p as Extract<Profile, { kind: 'polygon' }>).points : poly })
    }}><option value="rect">Rectangle</option><option value="circle">Circle</option><option value="polygon">Polygon</option></select></label>
    {p.kind === 'rect' && <><Expr label="Centre u" value={p.cu} onChange={(cu) => setProfile({ ...p, cu })}/><Expr label="Centre v" value={p.cv} onChange={(cv) => setProfile({ ...p, cv })}/><Expr label="Width (u)" value={p.width} onChange={(width) => setProfile({ ...p, width })}/><Expr label="Height (v)" value={p.height} onChange={(height) => setProfile({ ...p, height })}/></>}
    {p.kind === 'circle' && <><Expr label="Centre u" value={p.cu} onChange={(cu) => setProfile({ ...p, cu })}/><Expr label="Centre v" value={p.cv} onChange={(cv) => setProfile({ ...p, cv })}/><Expr label="Radius" value={p.radius} onChange={(radius) => setProfile({ ...p, radius })}/></>}
    {p.kind === 'polygon' && <>
      <SketchPad polygon={resolved.polygon} onAdd={(pt) => setProfile({ ...p, points: [...p.points, [String(pt[0]), String(pt[1])]] })}/>
      {p.points.map(([u, v], i) => <div key={i} className="poly-row"><span>{i + 1}</span>
        <input aria-label={`Point ${i + 1} u`} value={u} onChange={(e) => setProfile({ ...p, points: p.points.map((q, j) => j === i ? [e.target.value, q[1]] : q) })}/>
        <input aria-label={`Point ${i + 1} v`} value={v} onChange={(e) => setProfile({ ...p, points: p.points.map((q, j) => j === i ? [q[0], e.target.value] : q) })}/>
        <button className="icon-button small" aria-label={`Delete point ${i + 1}`} onClick={() => setProfile({ ...p, points: p.points.filter((_, j) => j !== i) })}><Trash2 size={11}/></button></div>)}
    </>}
    <div className="lab-subhead"><span>OPERATION</span></div>
    <div className="segmented">{(['extrude', 'revolve'] as const).map((k) => <button key={k} className={feature.op.kind === k ? 'active' : ''} onClick={() => update({ op: k === 'extrude' ? { kind: 'extrude', depth: '0.1', symmetric: true } : { kind: 'revolve', axis: 'u', angle: '360' } })}>{k.toUpperCase()}</button>)}</div>
    {feature.op.kind === 'extrude' ? <>
      <Expr label="Depth" value={feature.op.depth} onChange={(depth) => update({ op: { ...feature.op, depth } as Feature['op'] })}/>
      <label className="expr-field"><span>Symmetric</span><input type="checkbox" checked={feature.op.symmetric} onChange={(e) => update({ op: { ...feature.op, symmetric: e.target.checked } as Feature['op'] })}/></label>
    </> : <>
      <label className="expr-field"><span>Axis</span><select aria-label="Revolve axis" value={feature.op.axis} onChange={(e) => update({ op: { ...feature.op, axis: e.target.value } as Feature['op'] })}><option value="u">u axis (v = 0)</option><option value="v">v axis (u = 0)</option></select></label>
      <Expr label="Angle (deg)" value={feature.op.angle} onChange={(angle) => update({ op: { ...feature.op, angle } as Feature['op'] })}/>
    </>}
    <div className="lab-subhead"><span>DERIVED GEOMETRY</span><span>STUDY UNITS</span></div>
    {resolved.issues.length ? <div className="issues">{resolved.issues.map((i) => <p key={i}>{i}</p>)}</div> : <div className="results">
      <div className="result-row"><span className="result-label">Profile area</span><strong className="result-value">{fmt(resolved.area!, 5)} <small>su²</small></strong><ProvenanceBadge value="DERIVED"/></div>
      <div className="result-row"><span className="result-label">Profile centroid (u, v)</span><strong className="result-value">{resolved.centroid!.map((c) => c.toFixed(4)).join(', ')}</strong><ProvenanceBadge value="DERIVED"/></div>
      <div className="result-row"><span className="result-label">Solid volume</span><strong className="result-value">{fmt(resolved.volume!, 5)} <small>su³</small></strong><ProvenanceBadge value="DERIVED"/></div>
    </div>}
    <p className="lab-hint">Exact from the profile: shoelace area, and volume by area × depth or Pappus's theorem. Derived from the dimensions you entered, in study units; no material or mass is implied.</p>
  </>
}

/** Click to append polygon points in plane coordinates (snapped to 0.01 su). */
function SketchPad({ polygon, onAdd }: { polygon: P2[]; onAdd: (p: P2) => void }) {
  const pts = polygon.filter((q) => q.every(Number.isFinite))
  const us = pts.map((q) => q[0]), vs = pts.map((q) => q[1])
  const minU = Math.min(0, ...us) - 0.1, maxU = Math.max(0.2, ...us) + 0.1, minV = Math.min(0, ...vs) - 0.1, maxV = Math.max(0.2, ...vs) + 0.1
  const span = Math.max(maxU - minU, maxV - minV), W = 240
  const sx = (u: number) => (u - minU) / span * W, sy = (v: number) => W - (v - minV) / span * W
  return <svg className="sketch-pad" viewBox={`0 0 ${W} ${W}`} role="img" aria-label="Sketch pad: click to add a point" onClick={(e) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(), k = W / r.width
    const u = minU + (e.clientX - r.left) * k / W * span, v = minV + (W - (e.clientY - r.top) * k) / W * span
    onAdd([Math.round(u * 100) / 100, Math.round(v * 100) / 100])
  }}>
    <line x1={sx(minU)} x2={sx(maxU)} y1={sy(0)} y2={sy(0)} stroke="#7a3a35"/><line x1={sx(0)} x2={sx(0)} y1={sy(minV)} y2={sy(maxV)} stroke="#3a6a4a"/>
    {pts.length > 1 && <polygon points={pts.map(([u, v]) => sx(u) + ',' + sy(v)).join(' ')} fill="#c9a86a22" stroke="#e0b878"/>}
    {pts.map(([u, v], i) => <g key={i}><circle cx={sx(u)} cy={sy(v)} r={3} fill="#e0b878"/><text x={sx(u) + 5} y={sy(v) - 4}>{i + 1}</text></g>)}
  </svg>
}
