import { useState, type ReactNode } from 'react'
import type { Part } from '../model/components'
import MassLab, { useMassConfigurations } from './MassLab'

export type LabId = 'mass'
type Lab = { id: LabId; label: string; phase: string; summary: string }
const LABS: Lab[] = [
  { id: 'mass', label: 'Mass properties', phase: 'Phase 12', summary: 'Component masses, CoG, axle split, inertia, ballast and configuration comparison.' },
]

export default function AnalysisWorkspace({ parts, installedIds, onNotice }: { parts: Part[]; installedIds: string[]; onNotice: (text: string) => void }) {
  const [lab, setLab] = useState<LabId>('mass')
  const mass = useMassConfigurations(parts)
  const current = LABS.find((item) => item.id === lab)!
  const body: Record<LabId, ReactNode> = {
    mass: <MassLab parts={parts} installedIds={installedIds} configurations={mass.configurations} save={mass.save} onNotice={onNotice}/>,
  }
  return <section className="workspace analysis">
    <nav className="lab-tabs">{LABS.map((item) => <button key={item.id} className={item.id === lab ? 'active' : ''} onClick={() => setLab(item.id)}>{item.label}</button>)}
      <span className="lab-summary"><b>{current.phase}</b> {current.summary} Installed set follows the Workbench ({installedIds.length} parts).</span></nav>
    <div className="lab-body">{body[lab]}</div>
  </section>
}
