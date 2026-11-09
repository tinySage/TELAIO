/** 2D drafting sheet: orthographic views of the model, snapping, lines, dimensions, notes and a command line. */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react'
import { Download, Maximize, MousePointer2, PenLine, Ruler, Undo2 } from 'lucide-react'
import type { Part, Vec3 } from '../model/components'
import { mirror, type CornerHardpoints } from '../model/hardpoints'
import { partDrawingGeometry } from '../cad/partGeometry'
import { featureGeometry, type P2, type ResolvedFeature } from '../cad/solids'
import { bounds, DRAFT_VIEWS, dimensionLayout, dimensionValue, meshEdges, parseCommand, project, snap, snapTargets, type Annotation, type DimensionKind, type DraftView, type Segment, type Snap } from '../cad/drafting'
import { newId } from '../cad/design'

type Tool = 'select' | 'line' | 'dimension'
type Camera = { cx: number; cy: number; scale: number } // world centre and pixels per study unit
const VIEW_LABEL: Record<DraftView, string> = { side: 'SIDE · FROM LEFT', top: 'TOP · NOSE UP', front: 'FRONT' }

function modelLayers(view: DraftView, parts: Part[], features: ResolvedFeature[], corners: CornerHardpoints[]) {
  const body: Segment[] = []
  for (const part of parts) {
    const g = partDrawingGeometry(part)
    for (const m of g.meshes) { body.push(...meshEdges(m, view)); m.dispose() }
    for (const [a, b] of g.lines) body.push([project(view, a), project(view, b)])
  }
  const solids: Segment[] = []
  for (const f of features) {
    if (!f.visible) continue
    const g = featureGeometry(f)
    if (g) { solids.push(...meshEdges(g, view)); g.dispose() }
  }
  const links: Segment[] = []
  for (const h of corners) for (const side of [(v: Vec3) => v, mirror]) {
    for (const l of h.links) links.push([project(view, side(l.inboard)), project(view, side(l.outboard))])
    links.push([project(view, side(h.actuation.inboard)), project(view, side(h.actuation.outboard))])
  }
  return { body, solids, links }
}

const fmt = (v: number) => v.toFixed(3)
const pathOf = (segments: Segment[]) => segments.map(([a, b]) => `M${a[0]} ${-a[1]}L${b[0]} ${-b[1]}`).join('')

export default function DraftingView({ parts, features, corners, view, onView, annotations, onAnnotations, onNotice }: {
  parts: Part[]; features: ResolvedFeature[]; corners: CornerHardpoints[]; view: DraftView; onView: (v: DraftView) => void
  annotations: Annotation[]; onAnnotations: (next: Annotation[]) => void; onNotice: (t: string) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [camera, setCamera] = useState<Camera | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [dimKind, setDimKind] = useState<DimensionKind>('aligned')
  const [grid, setGrid] = useState<number | null>(0.05)
  const [pending, setPending] = useState<P2[]>([])
  const [cursor, setCursor] = useState<Snap | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [log, setLog] = useState<string[]>(['Type a command (LINE 0,0 1,0, DIM 0,0 1,0 H, NOTE x,y text, UNDO, GRID 0.05, VIEW TOP, FIT) or pick a tool.'])
  const [layers, setLayers] = useState({ body: true, solids: true, links: true })
  const drag = useRef<{ x: number; y: number; cam: Camera } | null>(null)

  const model = useMemo(() => modelLayers(view, parts, features, corners), [view, parts, features, corners])
  const userSegments = useMemo(() => annotations.flatMap((a) => a.kind === 'line' ? [[a.a, a.b] as Segment] : []), [annotations])
  const targets = useMemo(() => snapTargets([...(layers.body ? model.body : []), ...(layers.solids ? model.solids : []), ...(layers.links ? model.links : []), ...userSegments]), [model, layers, userSegments])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(200, e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fit = useCallback(() => {
    const b = bounds([...model.body, ...model.solids, ...model.links, ...userSegments])
    if (!b) { setCamera({ cx: 0, cy: 0, scale: 100 }); return }
    const w = b.max[0] - b.min[0] || 1, h = b.max[1] - b.min[1] || 1
    setCamera({ cx: (b.min[0] + b.max[0]) / 2, cy: (b.min[1] + b.max[1]) / 2, scale: 0.85 * Math.min(size.w / w, size.h / h) })
  }, [model, userSegments, size])
  // Refit when the view changes; edits within a view keep the camera.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fit() }, [view, size.w > 200])
  const cam = camera ?? { cx: 0, cy: 0, scale: 100 }

  const toWorld = (clientX: number, clientY: number): P2 => {
    const r = svgRef.current!.getBoundingClientRect()
    return [cam.cx + (clientX - r.left - size.w / 2) / cam.scale, cam.cy - (clientY - r.top - size.h / 2) / cam.scale]
  }
  const snapAt = (clientX: number, clientY: number) => snap(toWorld(clientX, clientY), targets, 9 / cam.scale, grid)

  const add = (items: Annotation[], message: string) => { onAnnotations([...annotations, ...items]); onNotice(message) }
  const say = (line: string) => setLog((l) => [...l.slice(-30), line])

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (tool === 'select' && e.button === 0 && !(e.target as Element).closest('[data-annotation]'))) {
      drag.current = { x: e.clientX, y: e.clientY, cam }; (e.target as Element).setPointerCapture?.(e.pointerId); setSelected(null); return
    }
    if (e.button === 2) { setPending([]); return }
    if (e.button !== 0) return
    const p = snapAt(e.clientX, e.clientY).point
    if (tool === 'line') {
      if (pending.length === 0) { setPending([p]); return }
      const a = pending[pending.length - 1]
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) < 1e-9) return
      add([{ id: newId('ln'), kind: 'line', a, b: p }], `Line ${fmt(Math.hypot(p[0] - a[0], p[1] - a[1]))} su`)
      setPending([p])
    } else if (tool === 'dimension') {
      if (pending.length < 2) { setPending([...pending, p]); return }
      const [a, b] = pending
      const offset = dimOffset(dimKind, a, b, p)
      add([{ id: newId('dim'), kind: 'dimension', dim: dimKind, a, b, offset }], `${dimKind} dimension ${fmt(dimensionValue(dimKind, a, b))} su`)
      setPending([])
    }
  }
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag.current) {
      const d = drag.current
      setCamera({ ...d.cam, cx: d.cam.cx - (e.clientX - d.x) / d.cam.scale, cy: d.cam.cy + (e.clientY - d.y) / d.cam.scale }); return
    }
    setCursor(snapAt(e.clientX, e.clientY))
  }
  const onWheel = (e: RWheelEvent<SVGSVGElement>) => {
    const before = toWorld(e.clientX, e.clientY), k = Math.exp(-e.deltaY * 0.0015)
    const scale = Math.min(5000, Math.max(10, cam.scale * k))
    const r = svgRef.current!.getBoundingClientRect()
    setCamera({ scale, cx: before[0] - (e.clientX - r.left - size.w / 2) / scale, cy: before[1] + (e.clientY - r.top - size.h / 2) / scale })
  }

  const run = (text: string) => {
    const last = pending.length ? pending[pending.length - 1] : (userSegments.at(-1)?.[1] ?? null)
    const { command: c, error } = parseCommand(text, last)
    if (text.trim()) say('> ' + text.trim())
    if (error) { say(error); return }
    if (!c) return
    switch (c.action) {
      case 'line': add(c.points.slice(1).map((b, i) => ({ id: newId('ln'), kind: 'line' as const, a: c.points[i], b })), `${c.points.length - 1} line(s) drawn`); say(`${c.points.length - 1} line(s)`); break
      case 'dimension': add([{ id: newId('dim'), kind: 'dimension', dim: c.dim, a: c.a, b: c.b, offset: c.offset }], 'Dimension added'); say(`${c.dim} ${fmt(dimensionValue(c.dim, c.a, c.b))} su`); break
      case 'note': add([{ id: newId('nt'), kind: 'note', at: c.at, text: c.text }], 'Note added'); break
      case 'undo': if (annotations.length) { onAnnotations(annotations.slice(0, -1)); say('Removed the last item') } else say('Nothing to undo'); break
      case 'erase-all': onAnnotations([]); say('All annotations in this view erased'); break
      case 'fit': fit(); break
      case 'grid': setGrid(c.size); say(c.size ? `Grid ${c.size} su` : 'Grid snap off'); break
      case 'tool': setTool(c.tool); setPending([]); say(`${c.tool} tool`); break
      case 'view': onView(c.view); break
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!svgRef.current?.isConnected || svgRef.current.getClientRects().length === 0) return
      if (e.key === 'Escape') { setPending([]); setTool('select') }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { onAnnotations(annotations.filter((a) => a.id !== selected)); setSelected(null) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); onAnnotations(annotations.slice(0, -1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, annotations, onAnnotations])

  const exportSvg = () => {
    const el = svgRef.current
    if (!el) return
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.querySelectorAll('[data-transient]').forEach((n) => n.remove())
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `telaio-${view}-drawing.svg`; a.click(); URL.revokeObjectURL(a.href)
    onNotice('Drawing exported as SVG')
  }

  const px = 1 / cam.scale, font = 11 * px
  const transform = `translate(${size.w / 2} ${size.h / 2}) scale(${cam.scale}) translate(${-cam.cx} ${cam.cy})`
  const preview: Annotation | null = cursor && pending.length ? (tool === 'line' ? { id: 'p', kind: 'line', a: pending[pending.length - 1], b: cursor.point }
    : tool === 'dimension' && pending.length === 2 ? { id: 'p', kind: 'dimension', dim: dimKind, a: pending[0], b: pending[1], offset: dimOffset(dimKind, pending[0], pending[1], cursor.point) }
    : tool === 'dimension' ? { id: 'p', kind: 'line', a: pending[0], b: cursor.point } : null) : null
  const gridLines = useMemo(() => {
    if (!grid || grid * cam.scale < 6) return ''
    const x0 = cam.cx - size.w / 2 / cam.scale, x1 = cam.cx + size.w / 2 / cam.scale, y0 = cam.cy - size.h / 2 / cam.scale, y1 = cam.cy + size.h / 2 / cam.scale
    let d = ''
    for (let x = Math.ceil(x0 / grid) * grid; x <= x1; x += grid) d += `M${x} ${-y1}V${-y0}`
    for (let y = Math.ceil(y0 / grid) * grid; y <= y1; y += grid) d += `M${x0} ${-y}H${x1}`
    return d
  }, [grid, cam, size])

  return <div className="drafting">
    <div className="drafting-toolbar">
      <div className="segmented">{DRAFT_VIEWS.map((v) => <button key={v} className={view === v ? 'active' : ''} onClick={() => onView(v)}>{VIEW_LABEL[v]}</button>)}</div>
      <span className="tool-divider"/>
      <button className={'icon-button ' + (tool === 'select' ? 'on' : '')} title="Select / pan (Esc)" aria-pressed={tool === 'select'} onClick={() => { setTool('select'); setPending([]) }}><MousePointer2 size={14}/></button>
      <button className={'icon-button ' + (tool === 'line' ? 'on' : '')} title="Line (L)" aria-pressed={tool === 'line'} onClick={() => { setTool('line'); setPending([]) }}><PenLine size={14}/></button>
      <button className={'icon-button ' + (tool === 'dimension' ? 'on' : '')} title="Dimension (DIM)" aria-pressed={tool === 'dimension'} onClick={() => { setTool('dimension'); setPending([]) }}><Ruler size={14}/></button>
      {tool === 'dimension' && <div className="segmented">{(['aligned', 'horizontal', 'vertical'] as const).map((k) => <button key={k} className={dimKind === k ? 'active' : ''} onClick={() => setDimKind(k)}>{k[0].toUpperCase()}</button>)}</div>}
      <span className="tool-divider"/>
      <button className="icon-button" title="Undo (Ctrl+Z)" onClick={() => run('UNDO')}><Undo2 size={14}/></button>
      <button className="icon-button" title="Fit drawing" onClick={fit}><Maximize size={14}/></button>
      <button className="icon-button" title="Export SVG" onClick={exportSvg}><Download size={14}/></button>
      <label className="layer-toggle">GRID <select aria-label="Grid" value={grid ?? 0} onChange={(e) => setGrid(Number(e.target.value) || null)}>{[0, 0.01, 0.025, 0.05, 0.1].map((g) => <option key={g} value={g}>{g ? g + ' su' : 'off'}</option>)}</select></label>
      {(['body', 'solids', 'links'] as const).map((k) => <label key={k} className="layer-toggle"><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })}/>{({ body: 'CAR', solids: 'SOLIDS', links: 'SUSPENSION' })[k]}</label>)}
    </div>
    <svg ref={svgRef} className={'drafting-sheet tool-' + tool} role="img" aria-label={`${view} drawing`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null }} onPointerLeave={() => setCursor(null)} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()}>
      <rect width="100%" height="100%" fill="#0e1214"/>
      <g transform={transform}>
        {gridLines && <path d={gridLines} stroke="#1c2327" strokeWidth={1} vectorEffect="non-scaling-stroke" data-transient/>}
        <path d={`M-0.2 0H0.2M0 -0.2V0.2`} stroke="#3c474d" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
        {layers.body && <path d={pathOf(model.body)} stroke="#6f7c83" strokeWidth={0.7} fill="none" vectorEffect="non-scaling-stroke"/>}
        {layers.links && <path d={pathOf(model.links)} stroke="#f2c14e" strokeWidth={1.4} fill="none" vectorEffect="non-scaling-stroke"/>}
        {layers.solids && <path d={pathOf(model.solids)} stroke="#e0b878" strokeWidth={1.1} fill="none" vectorEffect="non-scaling-stroke"/>}
        {annotations.map((a) => <AnnotationShape key={a.id} a={a} px={px} font={font} selected={selected === a.id} onSelect={tool === 'select' ? () => setSelected(a.id) : undefined}/>)}
        {preview && <g data-transient opacity={0.7}><AnnotationShape a={preview} px={px} font={font} selected={false}/></g>}
        {pending.map((p, i) => <circle key={i} cx={p[0]} cy={-p[1]} r={3 * px} fill="#e13b32" data-transient/>)}
        {cursor && tool !== 'select' && <SnapMarker s={cursor} px={px}/>}
      </g>
      <g className="title-block" transform={`translate(${size.w - 330} ${size.h - 58})`}>
        <rect width="320" height="48" fill="#0e1214" stroke="#3c474d"/>
        <text x="8" y="16">TELAIO · SF-24 STUDY · {VIEW_LABEL[view]}</text>
        <text x="8" y="30">Study units (su), not to scale · ILLUSTRATIVE geometry</text>
        <text x="8" y="42">Procedural envelopes · hidden lines not removed</text>
      </g>
    </svg>
    <div className="drafting-status">
      <span>{cursor ? `${cursor.kind.toUpperCase()} ${fmt(cursor.point[0])}, ${fmt(cursor.point[1])}` : 'u, v —'}</span>
      <span>{tool === 'line' ? (pending.length ? 'Click the next point · right-click or Esc to finish' : 'Click the first point') : tool === 'dimension' ? ['Click the first point', 'Click the second point', 'Click to place the dimension line'][pending.length] : 'Drag to pan · wheel to zoom · click an annotation, Delete to remove'}</span>
      <span>{annotations.length} annotation(s)</span>
    </div>
    <div className="command-line">
      <div className="command-log" aria-live="polite">{log.slice(-3).map((l, i) => <div key={i}>{l}</div>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); run(command); setCommand('') }}><span>COMMAND:</span><input aria-label="Command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="LINE 0,0 @1,0 · DIM 0,0 1,0 H · NOTE 0,0.5 text · UNDO"/></form>
    </div>
  </div>
}

/** Offset of the dimension line so it passes through the clicked point. */
function dimOffset(kind: DimensionKind, a: P2, b: P2, p: P2): number {
  if (kind === 'horizontal') return p[1] - Math.max(a[1], b[1])
  if (kind === 'vertical') return p[0] - Math.max(a[0], b[0])
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return ((p[0] - a[0]) * -(b[1] - a[1]) + (p[1] - a[1]) * (b[0] - a[0])) / len
}

function AnnotationShape({ a, px, font, selected, onSelect }: { a: Annotation; px: number; font: number; selected: boolean; onSelect?: () => void }) {
  const colour = selected ? '#e13b32' : '#9fd0f0'
  const common = { 'data-annotation': a.id, onPointerDown: onSelect ? (e: RPointerEvent) => { e.stopPropagation(); onSelect() } : undefined, style: { cursor: onSelect ? 'pointer' : undefined } }
  if (a.kind === 'line') return <g {...common}><line x1={a.a[0]} y1={-a.a[1]} x2={a.b[0]} y2={-a.b[1]} stroke="transparent" strokeWidth={8} vectorEffect="non-scaling-stroke"/><line x1={a.a[0]} y1={-a.a[1]} x2={a.b[0]} y2={-a.b[1]} stroke={colour} strokeWidth={1.4} vectorEffect="non-scaling-stroke"/></g>
  if (a.kind === 'note') return <text {...common} x={a.at[0]} y={-a.at[1]} fontSize={font} fill={colour} className="draft-text">{a.text}</text>
  const L = dimensionLayout(a.dim, a.a, a.b, a.offset), value = dimensionValue(a.dim, a.a, a.b)
  const [p1, p2] = L.line, ang = -L.angle * 180 / Math.PI, flip = ang > 90 || ang < -90
  const arrow = (at: P2, dir: number) => { const s = 6 * px, t = L.angle + dir; return `M${at[0]} ${-at[1]}l${-Math.cos(t - 0.3) * s} ${Math.sin(t - 0.3) * s}M${at[0]} ${-at[1]}l${-Math.cos(t + 0.3) * s} ${Math.sin(t + 0.3) * s}` }
  return <g {...common} stroke={colour} fill="none">
    <path d={L.extension.map(([s, e]) => `M${s[0]} ${-s[1]}L${e[0]} ${-e[1]}`).join('')} strokeWidth={0.6} vectorEffect="non-scaling-stroke" strokeDasharray="3 2"/>
    <line x1={p1[0]} y1={-p1[1]} x2={p2[0]} y2={-p2[1]} strokeWidth={8} stroke="transparent" vectorEffect="non-scaling-stroke"/>
    <line x1={p1[0]} y1={-p1[1]} x2={p2[0]} y2={-p2[1]} strokeWidth={1} vectorEffect="non-scaling-stroke"/>
    <path d={arrow(p2, 0) + arrow(p1, Math.PI)} strokeWidth={1} vectorEffect="non-scaling-stroke"/>
    <text x={L.text[0]} y={-L.text[1]} fontSize={font} fill={colour} stroke="none" textAnchor="middle" dy={-4 * px} transform={`rotate(${flip ? ang + 180 : ang} ${L.text[0]} ${-L.text[1]})`} className="draft-text">{value.toFixed(3)}</text>
  </g>
}

function SnapMarker({ s, px }: { s: Snap; px: number }) {
  const [x, y] = [s.point[0], -s.point[1]], r = 5 * px
  const colour = s.kind === 'endpoint' ? '#7fbd93' : s.kind === 'midpoint' ? '#78a9d1' : '#8b969d'
  return <g data-transient stroke={colour} fill="none" strokeWidth={1.4}>
    {s.kind === 'endpoint' && <rect x={x - r} y={y - r} width={2 * r} height={2 * r} vectorEffect="non-scaling-stroke"/>}
    {s.kind === 'midpoint' && <path d={`M${x} ${y - r}L${x + r} ${y + r}L${x - r} ${y + r}Z`} vectorEffect="non-scaling-stroke"/>}
    {(s.kind === 'grid' || s.kind === 'free') && <path d={`M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}`} vectorEffect="non-scaling-stroke"/>}
  </g>
}
