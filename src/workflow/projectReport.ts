/** Project revision report: provenance census, audit, packages and changes since the parent revision. */
import type { Census, Change, Project, Revision } from './projects'

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function projectReportHtml(project: Project, revision: Revision, census: Census, changes: Change[], packages: { name: string; solver: string; sha256: string }[], assemblyMatches: boolean): string {
  const bar = (n: number) => census.total ? Math.round(100 * n / census.total) : 0
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.name)} · ${esc(revision.id)}</title>
<style>body{font:14px/1.5 'IBM Plex Sans',system-ui,sans-serif;color:#1d2326;max-width:920px;margin:32px auto;padding:0 20px}h1{font-size:24px;margin:0}h2{font-size:14px;margin-top:26px;border-bottom:1px solid #ccd3d6;padding-bottom:4px;text-transform:uppercase;letter-spacing:.06em}table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #e3e7e9;vertical-align:top}th{background:#f2f4f5}code{font-family:'IBM Plex Mono',monospace;font-size:11.5px;word-break:break-all}.meta{color:#5b676d;font-size:12.5px}.bar{display:inline-block;height:8px;background:#9aa5aa;vertical-align:middle}.warn{background:#fff6e5;border:1px solid #e8c983;padding:8px 10px}</style></head><body>
<p class="meta">TELAIO project report</p><h1>${esc(project.name)}</h1>
<p class="meta">${esc(revision.id)} · “${esc(revision.message)}” · ${esc(revision.author)} · ${esc(revision.createdAt)}</p>
${project.description ? `<p>${esc(project.description)}</p>` : ''}
<p class="meta">Revision SHA-256 <code>${esc(revision.sha256)}</code> · parent ${esc(revision.parentId ?? 'none')}</p>
${assemblyMatches ? '' : '<p class="warn">This revision was made against a different assembly model than the current build. Component positions or relations have changed since.</p>'}
<h2>Provenance census · ${census.total} quantities</h2><table><tr><th>Label</th><th>Count</th><th></th></tr>${Object.entries(census.counts).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td><td><span class="bar" style="width:${bar(v) * 3}px"></span> ${bar(v)} %</td></tr>`).join('')}</table>
<h2>Audit · ${census.issues.length} issue(s)</h2>${census.issues.length ? `<table><tr><th>Domain</th><th>Value</th><th>Issue</th></tr>${census.issues.map((i) => `<tr><td>${esc(i.domain)}</td><td>${esc(i.path)}</td><td>${esc(i.issue)}</td></tr>`).join('')}</table>` : '<p>Every SOURCED value has a source and every ESTIMATED value has stated assumptions.</p>'}
<h2>Simulation packages · ${packages.length}</h2>${packages.length ? `<table><tr><th>Package</th><th>Solver</th><th>SHA-256</th></tr>${packages.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.solver)}</td><td><code>${esc(p.sha256)}</code></td></tr>`).join('')}</table>` : '<p>None.</p>'}
<h2>Changes since ${esc(revision.parentId ?? 'the start')} · ${changes.length}</h2>${changes.length ? `<table><tr><th>Area</th><th>Item</th><th>Before</th><th>After</th></tr>${changes.map((c) => `<tr><td>${esc(c.domain)}</td><td>${esc(c.path || '(whole area)')}</td><td>${esc(c.before ?? '—')}</td><td>${esc(c.after ?? '—')}</td></tr>`).join('')}</table>` : '<p>No changes.</p>'}
<h2>Reviews</h2>${revision.reviews.length ? `<table><tr><th>Reviewer</th><th>Verdict</th><th>Comment</th><th>When</th></tr>${revision.reviews.map((r) => `<tr><td>${esc(r.reviewer)}</td><td>${esc(r.verdict)}</td><td>${esc(r.comment)}</td><td>${esc(r.at)}</td></tr>`).join('')}</table>` : '<p>No reviews recorded.</p>'}
</body></html>`
}
