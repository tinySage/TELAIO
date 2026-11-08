import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, GitCommitHorizontal, History, Play, Plus, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { applyOverrides, assemblyFingerprint, captureWorkspace, commitRevision, diffSnapshots, exportProject, importProject, packagesIn, PROJECT_STORAGE_KEY, provenanceCensus, restoreWorkspace, verifyHistory, type Project, type ReviewNote, type Revision, type StudyDefinition, type WorkspaceStore } from '../workflow/projects'
import { projectReportHtml } from '../workflow/projectReport'
import { inputRows } from '../sim/reports'
import { SOLVERS, type SolverId } from '../sim/solvers'
import type { JobRunner } from '../sim/useJobRunner'
import { PROVENANCES, type Provenance } from '../engineering/quantity'
import { labInputs } from './SimulationWorkspace'
import { newId, ProvenanceBadge, storage } from './engineeringUi'

const browserStore: WorkspaceStore = {
  get: (k) => storage.read(k),
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* reported by caller */ } },
  remove: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}
type Stored = { projects: Project[]; activeId: string | null }
function load(): Stored {
  try { const raw = JSON.parse(storage.read(PROJECT_STORAGE_KEY) ?? 'null'); if (raw && Array.isArray(raw.projects)) return { projects: raw.projects, activeId: raw.activeId ?? raw.projects[0]?.id ?? null } } catch { /* empty */ }
  return { projects: [], activeId: null }
}
const download = (name: string, content: string, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url) }
const slug = (s: string) => s.replace(/[^\w-]+/g, '_').slice(0, 50)
const kb = (n: number) => (n / 1024).toFixed(0) + ' kB'

async function assetIntegrity(): Promise<Record<string, string>> {
  try { const m = await (await fetch('/geometry/manifest.json')).json(); return Object.fromEntries((m.entries ?? []).filter((e: { integrity?: unknown }) => e.integrity).map((e: { componentId: string; integrity: { sha256: string } }) => [e.componentId, e.integrity.sha256])) } catch { return {} }
}

export default function ProjectWorkspace({ runner, active, onNotice }: { runner: JobRunner; active: boolean; onNotice: (text: string) => void }) {
  const [stored, setStored] = useState(load)
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState('')
  const [author, setAuthor] = useState(() => storage.read('telaio.author') ? JSON.parse(storage.read('telaio.author')!) : '')
  const [selected, setSelected] = useState<string | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [historyCheck, setHistoryCheck] = useState<string | null>(null)
  const [currentFingerprint, setCurrentFingerprint] = useState('')
  const [review, setReview] = useState<Omit<ReviewNote, 'at'>>({ reviewer: '', verdict: 'comment', comment: '' })
  const [study, setStudy] = useState<StudyDefinition>({ id: '', name: '', solver: 'braking-study', overrides: [] })
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { void assemblyFingerprint().then(setCurrentFingerprint) }, [])

  const persist = (next: Stored) => {
    setStored(next)
    if (!storage.write(PROJECT_STORAGE_KEY, next)) onNotice('Browser storage is full: export the project and delete old projects to keep committing')
  }
  const project = stored.projects.find((p) => p.id === stored.activeId) ?? null
  const updateProject = (next: Project) => persist({ ...stored, projects: stored.projects.map((p) => p.id === next.id ? next : p) })
  const revisions = project?.revisions ?? []
  const revision = revisions.find((r) => r.id === selected) ?? revisions[revisions.length - 1] ?? null
  const parent = revision?.parentId ? revisions.find((r) => r.id === revision.parentId) ?? null : null
  const census = useMemo(() => revision ? provenanceCensus(revision.snapshot) : null, [revision])
  const comparing = compare.length === 2 ? compare.map((id) => revisions.find((r) => r.id === id)!).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : null
  const changes = useMemo(() => comparing ? diffSnapshots(comparing[0].snapshot, comparing[1].snapshot) : revision ? diffSnapshots(parent?.snapshot ?? {}, revision.snapshot) : [], [comparing, revision, parent])
  const workspaceSize = useMemo(() => JSON.stringify(captureWorkspace(browserStore)).length, [stored, runner.jobs.length, active]) // eslint-disable-line react-hooks/exhaustive-deps
  const projectsSize = JSON.stringify(stored).length
  const quantityPaths = useMemo(() => { const { inputs } = labInputs(study.solver as SolverId, { parameter: 'clA', from: 2, to: 7, steps: 21 }, 'front'); return inputs ? inputRows(inputs).filter((r) => r.provenance).map((r) => r.name) : [] }, [study.solver, active]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = async () => {
    if (!project) return
    storage.write('telaio.author', author)
    const rev = await commitRevision(project, captureWorkspace(browserStore), message, author, { assembly: currentFingerprint || await assemblyFingerprint(), assets: await assetIntegrity() })
    updateProject({ ...project, revisions: [...project.revisions, rev] }); setSelected(rev.id); setCompare([]); setMessage('')
    onNotice(`Committed ${rev.id} "${rev.message}" · ${rev.sha256.slice(0, 12)}…`)
  }
  const restore = (rev: Revision) => {
    if (!window.confirm(`Load ${rev.id} "${rev.message}" into the workspace? Current unsaved lab state is replaced (commit it first to keep it). History is not changed. The page will reload.`)) return
    restoreWorkspace(browserStore, rev.snapshot); window.location.reload()
  }
  const runStudy = (def: StudyDefinition) => {
    const base = labInputs(def.solver as SolverId, { parameter: 'clA', from: 2, to: 7, steps: 21 }, 'front')
    if (!base.inputs) { onNotice('Cannot run "' + def.name + '": ' + base.note); return }
    const { inputs, errors } = applyOverrides(base.inputs, def.overrides)
    if (errors.length) { onNotice('Study "' + def.name + '": ' + errors.join('; ')); return }
    runner.submit('Study: ' + def.name, def.solver as SolverId, inputs); onNotice('Study "' + def.name + '" queued: see the Simulation view')
  }

  return <section className="workspace">
    <div className="lab">
      <section className="lab-column lab-inputs">
        <div className="lab-toolbar">
          <select value={stored.activeId ?? ''} onChange={(e) => { persist({ ...stored, activeId: e.target.value }); setSelected(null); setCompare([]) }} aria-label="Project" disabled={!stored.projects.length}>{stored.projects.length ? stored.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : <option>No project</option>}</select>
          <input className="lab-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New project name…" aria-label="New project name"/>
          <button disabled={!newName.trim()} onClick={() => { const p: Project = { id: newId('project'), name: newName.trim(), description: '', createdAt: new Date().toISOString(), revisions: [], studies: [] }; persist({ projects: [...stored.projects, p], activeId: p.id }); setNewName(''); onNotice('Project "' + p.name + '" created') }}><Plus size={13}/> Create</button>
        </div>
        <div className="lab-toolbar">
          <button disabled={!project} onClick={() => project && download(slug(project.name) + '.telaio-project.json', JSON.stringify(exportProject(project), null, 2), 'application/json')}><Download size={13}/> Export</button>
          <button onClick={() => fileRef.current?.click()}><Upload size={13}/> Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            try {
              const { project: imported, errors } = await importProject(JSON.parse(await f.text()))
              if (!imported) { setHistoryCheck('✗ Import refused: ' + errors.slice(0, 3).join('; ')); return }
              const copy = stored.projects.some((p) => p.id === imported.id) ? { ...imported, id: newId('project'), name: imported.name + ' (imported)' } : imported
              persist({ projects: [...stored.projects, copy], activeId: copy.id }); setHistoryCheck(`✓ Imported "${copy.name}": ${copy.revisions.length} revision seals and parent links verified`)
            } catch { setHistoryCheck('✗ Not a readable project file') }
          }}/>
          <button disabled={!project} onClick={async () => { if (!project) return; const v = await verifyHistory(project); setHistoryCheck(v.valid ? `✓ ${project.revisions.length} revisions: every seal intact, parent chain unbroken` : '✗ ' + v.errors.join('; ')) }}><ShieldCheck size={13}/> Verify history</button>
          <button disabled={!project} onClick={() => { if (project && window.confirm('Delete project "' + project.name + '" and its history from this browser? Export it first to keep a copy.')) persist({ projects: stored.projects.filter((p) => p.id !== project.id), activeId: stored.projects.find((p) => p.id !== project.id)?.id ?? null }) }} aria-label="Delete project"><Trash2 size={13}/></button>
        </div>
        {historyCheck && <p className={'lab-hint verdict ' + (historyCheck.startsWith('✓') ? 'ok' : 'bad')}>{historyCheck}</p>}
        <p className="lab-hint">Projects live only in this browser ({kb(projectsSize)} projects · {kb(workspaceSize)} current workspace). There is no sharing or access control yet: that needs a server (docs/COLLABORATION_DESIGN.md). Export files are the way to share and back up.</p>
        {project && <>
          <textarea className="csv-input" rows={2} value={project.description} onChange={(e) => updateProject({ ...project, description: e.target.value })} placeholder="Project description…" aria-label="Project description"/>
          <div className="lab-subhead"><span>COMMIT CURRENT WORKSPACE</span></div>
          <div className="inline-form"><label>Author <input value={author} onChange={(e) => setAuthor(e.target.value)} style={{ width: 120 }}/></label></div>
          <form className="state-save" onSubmit={(e) => { e.preventDefault(); void commit() }}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What changed and why…" aria-label="Commit message"/><button type="submit"><GitCommitHorizontal size={13}/> Commit</button></form>
          <div className="lab-subhead"><span><History size={11}/> HISTORY · {revisions.length} REVISIONS</span><span>{compare.length === 2 ? 'COMPARING 2' : 'TICK TWO TO COMPARE'}</span></div>
          {[...revisions].reverse().map((r) => {
            const verdict = r.reviews.at(-1)?.verdict
            return <div key={r.id} className={'rev-row' + (revision?.id === r.id && !comparing ? ' selected' : '')}>
              <input type="checkbox" checked={compare.includes(r.id)} onChange={() => setCompare((c) => c.includes(r.id) ? c.filter((x) => x !== r.id) : [...c.slice(-1), r.id])} aria-label={'Compare ' + r.id}/>
              <button className="rev-main" onClick={() => { setSelected(r.id); setCompare([]) }}><strong>{r.message}</strong><span>{r.id} · {r.author} · {new Date(r.createdAt).toLocaleString()} · {r.sha256.slice(0, 10)}{r.context.assembly !== currentFingerprint && currentFingerprint ? ' · other model' : ''}</span></button>
              {verdict && <span className={'review-badge ' + verdict}>{verdict === 'approved' ? 'APPROVED' : verdict === 'changes-requested' ? 'CHANGES' : 'NOTE'}</span>}
            </div>
          })}
          <div className="lab-subhead"><span>USER-DEFINED STUDIES · RUN IN THE SIMULATION QUEUE</span></div>
          {project.studies.map((s) => <div className="rev-row" key={s.id}><button className="rev-main" onClick={() => runStudy(s)}><strong>{s.name}</strong><span>{SOLVERS[s.solver as SolverId]?.label} · {s.overrides.map((o) => `${o.path} = ${o.value} (${o.provenance})`).join(', ') || 'lab inputs as they are'}</span></button>
            <button className="icon-button small" onClick={() => runStudy(s)} aria-label={'Run ' + s.name}><Play size={12}/></button>
            <button className="icon-button small" onClick={() => updateProject({ ...project, studies: project.studies.filter((x) => x.id !== s.id) })} aria-label={'Delete ' + s.name}><Trash2 size={12}/></button></div>)}
          <div className="study-form">
            <div className="inline-form"><label>Name <input value={study.name} onChange={(e) => setStudy({ ...study, name: e.target.value })} style={{ width: 150 }}/></label>
              <label>Solver <select value={study.solver} onChange={(e) => setStudy({ ...study, solver: e.target.value, overrides: [] })}>{Object.values(SOLVERS).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div>
            {study.overrides.map((o, i) => <div className="override-row" key={i}>
              <select value={o.path} onChange={(e) => setStudy({ ...study, overrides: study.overrides.map((x, j) => j === i ? { ...x, path: e.target.value } : x) })} aria-label="Override input">{quantityPaths.map((p) => <option key={p}>{p}</option>)}</select>
              <input type="number" value={o.value} onChange={(e) => setStudy({ ...study, overrides: study.overrides.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x) })} aria-label="Override value"/>
              <select value={o.provenance} onChange={(e) => setStudy({ ...study, overrides: study.overrides.map((x, j) => j === i ? { ...x, provenance: e.target.value as Provenance } : x) })} aria-label="Override provenance">{PROVENANCES.filter((p) => p !== 'UNKNOWN').map((p) => <option key={p}>{p}</option>)}</select>
              <input value={o.note} placeholder={o.provenance === 'SOURCED' ? 'Source' : 'Reason / assumption'} onChange={(e) => setStudy({ ...study, overrides: study.overrides.map((x, j) => j === i ? { ...x, note: e.target.value } : x) })} aria-label="Override note"/>
              <button className="mini" onClick={() => setStudy({ ...study, overrides: study.overrides.filter((_, j) => j !== i) })} aria-label="Remove override"><Trash2 size={11}/></button></div>)}
            <div className="lab-toolbar"><button className="mini" disabled={!quantityPaths.length} onClick={() => setStudy({ ...study, overrides: [...study.overrides, { path: quantityPaths[0], value: 0, provenance: 'ESTIMATED', note: '' }] })}><Plus size={11}/> Override an input</button>
              <button className="mini" disabled={!study.name.trim()} onClick={() => { updateProject({ ...project, studies: [...project.studies, { ...study, id: newId('study'), name: study.name.trim() }] }); setStudy({ id: '', name: '', solver: study.solver, overrides: [] }) }}><Plus size={11}/> Save study</button></div>
            {!quantityPaths.length && <p className="lab-hint">Set up inputs in the matching lab first; studies override them.</p>}
          </div>
        </>}
      </section>
      <section className="lab-column lab-results">
        {!project && <div className="empty-state"><strong>No project</strong><p>Create a project, then commit the workspace to start its history.</p></div>}
        {project && !revision && <div className="empty-state"><strong>No revisions yet</strong><p>Commit the current workspace to create the first revision.</p></div>}
        {comparing && <>
          <div className="lab-subhead"><span>COMPARE {comparing[0].id} → {comparing[1].id}</span><span>{changes.length} CHANGE(S)</span></div>
          {comparing[0].context.assembly !== comparing[1].context.assembly && <p className="lab-hint verdict bad">The assembly model changed between these revisions.</p>}
          <ChangeTable changes={changes}/>
        </>}
        {!comparing && revision && census && <>
          <div className="lab-subhead"><span>{revision.id} · {revision.message}</span><span>{revision.author}</span></div>
          <div className="lab-toolbar">
            <button onClick={() => restore(revision)}><RotateCcw size={13}/> Load into workspace</button>
            <button onClick={() => download(slug(project!.name) + '-' + revision.id + '-report.html', projectReportHtml(project!, revision, census, changes, packagesIn(revision.snapshot), revision.context.assembly === currentFingerprint), 'text/html')}><FileText size={13}/> Report</button>
          </div>
          <p className="lab-hint">SHA-256 <code className="hash">{revision.sha256}</code> · parent {revision.parentId ?? 'none'} · {new Date(revision.createdAt).toLocaleString()}</p>
          <p className={'lab-hint verdict ' + (revision.context.assembly === currentFingerprint ? 'ok' : 'bad')}>{revision.context.assembly === currentFingerprint ? 'Made against the current assembly model' : 'Made against a different assembly model than this build'} · {Object.keys(revision.context.assets).length} asset integrity record(s)</p>
          <div className="lab-subhead"><span>PROVENANCE CENSUS · {census.total} QUANTITIES</span></div>
          <div className="census">{PROVENANCES.map((p) => <div className="census-row" key={p}><ProvenanceBadge value={p}/><i className={'census-bar prov-' + p.toLowerCase()} style={{ width: (census.total ? 100 * census.counts[p] / census.total : 0) + '%' }}/><span>{census.counts[p]}</span></div>)}</div>
          <div className="lab-subhead"><span>AUDIT · {census.issues.length} ISSUE(S)</span></div>
          {census.issues.length ? <div className="issues">{census.issues.slice(0, 12).map((i, k) => <p key={k}>{i.domain} › {i.path}: {i.issue.replace(/^.*?: /, '')}</p>)}</div> : <p className="lab-hint">Every SOURCED value has a source and every ESTIMATED value has assumptions.</p>}
          <div className="lab-subhead"><span>CHANGES SINCE {revision.parentId ?? 'START'} · {changes.length}</span></div>
          <ChangeTable changes={changes}/>
          <div className="lab-subhead"><span>SIMULATION PACKAGES · {packagesIn(revision.snapshot).length}</span></div>
          {packagesIn(revision.snapshot).map((p) => <p className="lab-hint" key={p.sha256}>{p.name} · {p.solver} · <code className="hash">{p.sha256.slice(0, 16)}…</code></p>)}
          <div className="lab-subhead"><span>REVIEW (LOCAL NOTES, OUTSIDE THE SEAL)</span></div>
          {revision.reviews.map((r, i) => <p className="lab-hint" key={i}><span className={'review-badge ' + r.verdict}>{r.verdict.toUpperCase()}</span> {r.reviewer}: {r.comment} <small>{new Date(r.at).toLocaleString()}</small></p>)}
          <form className="review-form" onSubmit={(e) => { e.preventDefault(); if (!review.reviewer.trim() || !review.comment.trim()) return; updateProject({ ...project!, revisions: project!.revisions.map((r) => r.id === revision.id ? { ...r, reviews: [...r.reviews, { ...review, at: new Date().toISOString() }] } : r) }); setReview({ ...review, comment: '' }) }}>
            <input value={review.reviewer} onChange={(e) => setReview({ ...review, reviewer: e.target.value })} placeholder="Reviewer" aria-label="Reviewer"/>
            <select value={review.verdict} onChange={(e) => setReview({ ...review, verdict: e.target.value as ReviewNote['verdict'] })} aria-label="Verdict"><option value="comment">Comment</option><option value="approved">Approve</option><option value="changes-requested">Request changes</option></select>
            <input value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} placeholder="Comment" aria-label="Review comment"/>
            <button type="submit">Add</button>
          </form>
        </>}
      </section>
    </div>
  </section>
}

function ChangeTable({ changes }: { changes: ReturnType<typeof diffSnapshots> }) {
  if (!changes.length) return <p className="lab-hint">No changes.</p>
  return <div className="change-table">{changes.slice(0, 200).map((c, i) => <div key={i} className={'change-row ' + c.kind}>
    <span className="change-domain">{c.domain}</span><span className="change-path">{c.path || '(whole area)'}</span>
    <span className="change-values">{c.kind === 'added' ? '+ ' + c.after : c.kind === 'removed' ? '− ' + c.before : c.before + '  →  ' + c.after}</span></div>)}
    {changes.length > 200 && <p className="lab-hint">…and {changes.length - 200} more (the report lists all).</p>}</div>
}
