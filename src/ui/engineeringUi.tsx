/** Shared controls for engineering quantities: provenance badges, quantity editors and result readouts. */
import { PROVENANCE_MEANING, PROVENANCES, formatValue, type Provenance, type Quantity, type Result } from '../engineering/quantity'

export function ProvenanceBadge({ value }: { value: Provenance }) {
  return <b className={'prov prov-' + value.toLowerCase()} title={PROVENANCE_MEANING[value]}>{value}</b>
}

/** Value + provenance + source/assumption editor. Choosing UNKNOWN clears the value. */
export function QuantityInput({ value, onChange, label, step = 'any', compact = false }: { value: Quantity; onChange: (q: Quantity) => void; label: string; step?: string; compact?: boolean }) {
  const needsSource = value.provenance === 'SOURCED', needsNote = value.provenance === 'ESTIMATED' || value.provenance === 'ILLUSTRATIVE'
  return <div className={'qty' + (compact ? ' compact' : '')}>
    <input className="qty-value" type="number" step={step} aria-label={label + ' value'} value={value.value ?? ''} placeholder="—"
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') { onChange({ ...value, value: null, provenance: 'UNKNOWN' }); return }
        onChange({ ...value, value: Number(raw), provenance: value.provenance === 'UNKNOWN' ? 'ESTIMATED' : value.provenance })
      }}/>
    <span className="qty-unit">{value.unit}</span>
    <select className="qty-prov" aria-label={label + ' provenance'} value={value.provenance} onChange={(e) => {
      const provenance = e.target.value as Provenance
      onChange(provenance === 'UNKNOWN' ? { value: null, unit: value.unit, provenance } : { ...value, provenance })
    }}>{PROVENANCES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
    {!compact && (needsSource || needsNote) && <input className={'qty-detail' + ((needsSource && !value.source?.trim()) || (value.provenance === 'ESTIMATED' && !value.note?.trim()) ? ' required' : '')}
      aria-label={label + (needsSource ? ' source' : ' assumptions')} placeholder={needsSource ? 'Source record (required)' : value.provenance === 'ESTIMATED' ? 'Assumptions (required)' : 'Note'}
      value={(needsSource ? value.source : value.note) ?? ''} onChange={(e) => onChange(needsSource ? { ...value, source: e.target.value } : { ...value, note: e.target.value })}/>}
  </div>
}

export function ResultRow({ label, result, format }: { label: string; result: Result<unknown>; format: (value: never) => string }) {
  return <div className="result-row">
    <span className="result-label">{label}</span>
    <strong className="result-value">{result.value === null ? '—' : format(result.value as never)} {result.value !== null && result.unit !== 'fraction' && <small>{result.unit}</small>}</strong>
    <ProvenanceBadge value={result.provenance}/>
  </div>
}

export const fmt = (value: number, digits = 3) => formatValue(value, digits)
export const pct = (value: number) => (value * 100).toFixed(1) + ' %'

/** Missing inputs and assumptions behind a set of results, deduplicated. */
export function ResultNotes({ results, missingLabel }: { results: Result<unknown>[]; missingLabel?: (id: string) => string }) {
  const missing = [...new Set(results.flatMap((r) => r.missing))]
  const assumptions = [...new Set(results.flatMap((r) => r.assumptions))]
  return <div className="result-notes">
    {missing.length > 0 && <p className="missing"><strong>Missing inputs ({missing.length}):</strong> {missing.slice(0, 12).map((id) => missingLabel?.(id) ?? id).join(', ')}{missing.length > 12 ? ' …' : ''}</p>}
    {assumptions.length > 0 && <ul>{assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
  </div>
}

/** Minimal SVG line chart for engineering sweeps; series share an x axis. */
export function LineChart({ x, series, xLabel, yLabel, height = 180, markers = [] }: { x: number[]; series: { name: string; y: (number | null)[]; colour: string }[]; xLabel: string; yLabel: string; height?: number; markers?: { x: number; label: string }[] }) {
  const width = 420, pad = { l: 46, r: 12, t: 12, b: 32 }
  const ys = series.flatMap((s) => s.y.filter((v): v is number => v !== null && Number.isFinite(v)))
  if (x.length < 2 || ys.length === 0) return <div className="chart-empty">No computable values to plot</div>
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)]
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1 }
  const [x0, x1] = [Math.min(...x), Math.max(...x)]
  const sx = (v: number) => pad.l + (v - x0) / (x1 - x0) * (width - pad.l - pad.r)
  const sy = (v: number) => height - pad.b - (v - y0) / (y1 - y0) * (height - pad.t - pad.b)
  const ticks = (a: number, b: number) => [0, 0.25, 0.5, 0.75, 1].map((t) => a + t * (b - a))
  return <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={yLabel + ' against ' + xLabel}>
    {ticks(y0, y1).map((t) => <g key={'y' + t}><line x1={pad.l} x2={width - pad.r} y1={sy(t)} y2={sy(t)} className="grid"/><text x={pad.l - 6} y={sy(t) + 3} textAnchor="end">{formatValue(t, 2)}</text></g>)}
    {ticks(x0, x1).map((t) => <text key={'x' + t} x={sx(t)} y={height - pad.b + 14} textAnchor="middle">{formatValue(t, 2)}</text>)}
    <text x={(pad.l + width - pad.r) / 2} y={height - 4} textAnchor="middle" className="axis-label">{xLabel}</text>
    <text x={10} y={pad.t + 4} className="axis-label">{yLabel}</text>
    {markers.map((m) => <g key={m.label}><line x1={sx(m.x)} x2={sx(m.x)} y1={pad.t} y2={height - pad.b} className="marker"/><text x={sx(m.x) + 3} y={pad.t + 10} className="marker-label">{m.label}</text></g>)}
    {series.map((s) => {
      const d = s.y.map((v, i) => v === null || !Number.isFinite(v) ? null : `${sx(x[i])},${sy(v)}`).reduce<string[]>((acc, point, i, all) => {
        if (point) acc.push((i === 0 || !all[i - 1] ? 'M' : 'L') + point)
        return acc
      }, []).join(' ')
      return <path key={s.name} d={d} fill="none" stroke={s.colour} strokeWidth="1.8"/>
    })}
    {series.length > 1 && series.map((s, i) => <g key={'l' + s.name} transform={`translate(${pad.l + 8 + i * 110},${pad.t + 4})`}><rect width="10" height="3" y="-3" fill={s.colour}/><text x="14" y="0">{s.name}</text></g>)}
  </svg>
}

/** Stable short ID for user-created records. */
export const newId = (prefix: string) => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/** Reads and writes JSON in browser storage, tolerating unavailable storage. */
export const storage = {
  read(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } },
  write(key: string, value: unknown): boolean { try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false } },
}
