/**
 * Engineering reports from a simulation package: every input with its provenance and source, the
 * assumptions, the outputs, the solver and version, and the package hash, so a reader can reproduce
 * the result. HTML is self-contained (prints to PDF from the browser); Markdown suits version control.
 */
import type { Quantity } from '../engineering/quantity'
import { SOLVERS } from './solvers'
import type { PackageVerdict, SimulationPackage } from './packages'

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const num = (v: unknown) => typeof v === 'number' ? (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(4) : Number(v.toPrecision(6)).toString()) : v === null ? '—' : String(v)

type InputRow = { name: string; value: string; unit: string; provenance: string; detail: string }

/** Flattens solver inputs into rows; quantities show provenance and source, other values are listed as given. */
export function inputRows(inputs: unknown, prefix = ''): InputRow[] {
  if (!inputs || typeof inputs !== 'object') return []
  const rows: InputRow[] = []
  for (const [key, value] of Object.entries(inputs as Record<string, unknown>)) {
    const name = prefix ? prefix + '.' + key : key
    if (value && typeof value === 'object' && 'provenance' in value && 'unit' in value) {
      const q = value as Quantity
      rows.push({ name, value: num(q.value), unit: q.unit, provenance: q.provenance, detail: q.source ?? q.note ?? '' })
    } else if (Array.isArray(value)) {
      rows.push({ name, value: value.length > 6 ? `${value.length} entries` : JSON.stringify(value), unit: '', provenance: '', detail: '' })
    } else if (value && typeof value === 'object') {
      rows.push(...inputRows(value, name))
    } else rows.push({ name, value: num(value), unit: '', provenance: '', detail: '' })
  }
  return rows
}

export function reportHtml(pkg: SimulationPackage, verdict?: PackageVerdict | null): string {
  const solver = SOLVERS[pkg.solver.id]
  const rows = inputRows(pkg.inputs)
  const outputs = Object.entries(pkg.outputs.summary)
  const provs = [...new Set(outputs.map(([, o]) => o.provenance))]
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(pkg.name)} — TELAIO report</title>
<style>body{font:14px/1.5 'IBM Plex Sans',system-ui,sans-serif;color:#1d2326;max-width:900px;margin:32px auto;padding:0 20px}h1{font-size:24px;margin:0}h2{font-size:15px;margin-top:28px;border-bottom:1px solid #ccd3d6;padding-bottom:4px;text-transform:uppercase;letter-spacing:.06em}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #e3e7e9;vertical-align:top}th{background:#f2f4f5}td.n{font-family:'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}
.prov{font:11px 'IBM Plex Mono',monospace;padding:1px 5px;border:1px solid #9aa5aa;border-radius:2px}.meta{color:#5b676d;font-size:12.5px}code{font-family:'IBM Plex Mono',monospace;font-size:12px;word-break:break-all}.ok{color:#2c6e4f}.bad{color:#a3471f}.warn{background:#fff6e5;border:1px solid #e8c983;padding:8px 10px;font-size:12.5px}</style></head><body>
<p class="meta">TELAIO engineering report</p><h1>${esc(pkg.name)}</h1>
<p class="meta">${esc(solver?.label ?? pkg.solver.id)} · solver <code>${esc(pkg.solver.id)} ${esc(pkg.solver.version)}</code> · created ${esc(pkg.createdAt)}</p>
${provs.some((p) => p !== 'DERIVED') ? `<p class="warn">Results carry provenance ${provs.map((p) => '<b>' + esc(p) + '</b>').join(', ')}. ILLUSTRATIVE or ESTIMATED inputs limit what these results can be used for; UNKNOWN means not computed.</p>` : ''}
<h2>Results</h2><table><tr><th>Output</th><th>Value</th><th>Unit</th><th>Provenance</th></tr>${outputs.map(([k, o]) => `<tr><td>${esc(k)}</td><td class="n">${esc(num(o.value))}</td><td>${esc(o.unit)}</td><td><span class="prov">${esc(o.provenance)}</span></td></tr>`).join('')}</table>
${pkg.outputs.missing.length ? `<p class="bad">Missing inputs: ${pkg.outputs.missing.map(esc).join(', ')}</p>` : ''}
<h2>Inputs</h2><table><tr><th>Input</th><th>Value</th><th>Unit</th><th>Provenance</th><th>Source / assumptions</th></tr>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${esc(r.value)}</td><td>${esc(r.unit)}</td><td>${r.provenance ? `<span class="prov">${esc(r.provenance)}</span>` : ''}</td><td>${esc(r.detail)}</td></tr>`).join('')}</table>
<h2>Assumptions</h2><ul>${pkg.outputs.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
<h2>Reproducibility</h2><p>Package SHA-256 <code>${esc(pkg.sha256)}</code></p>
${verdict ? `<p class="${verdict.reproduced ? 'ok' : 'bad'}">${esc(verdict.message)}</p>` : '<p class="meta">Not verified at report time.</p>'}
<p class="meta">Re-run by importing the package into TELAIO (Simulation → Import package). The seal covers solver, inputs and outputs; any edit breaks it.</p>
</body></html>`
}

export function reportMarkdown(pkg: SimulationPackage, verdict?: PackageVerdict | null): string {
  const cell = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const solver = SOLVERS[pkg.solver.id]
  return [
    `# ${pkg.name}`, '', `${solver?.label ?? pkg.solver.id} · solver \`${pkg.solver.id} ${pkg.solver.version}\` · created ${pkg.createdAt}`, '',
    '## Results', '', '| Output | Value | Unit | Provenance |', '| --- | ---: | --- | --- |',
    ...Object.entries(pkg.outputs.summary).map(([k, o]) => `| ${cell(k)} | ${cell(num(o.value))} | ${cell(o.unit)} | ${o.provenance} |`), '',
    ...(pkg.outputs.missing.length ? ['Missing inputs: ' + pkg.outputs.missing.join(', '), ''] : []),
    '## Inputs', '', '| Input | Value | Unit | Provenance | Source / assumptions |', '| --- | ---: | --- | --- | --- |',
    ...inputRows(pkg.inputs).map((r) => `| ${cell(r.name)} | ${cell(r.value)} | ${cell(r.unit)} | ${r.provenance} | ${cell(r.detail)} |`), '',
    '## Assumptions', '', ...pkg.outputs.assumptions.map((a) => '- ' + a), '',
    '## Reproducibility', '', `Package SHA-256: \`${pkg.sha256}\``, '', verdict ? verdict.message : 'Not verified at report time.', '',
  ].join('\n')
}
