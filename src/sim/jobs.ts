/** Simulation jobs and their persisted store. */
import type { SolverId, SolverOutput } from './solvers'
import { SOLVERS } from './solvers'
import type { SimulationPackage } from './packages'

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
export type Job = {
  id: string; name: string; solver: SolverId; inputs: unknown
  status: JobStatus; progress: number
  createdAt: string; startedAt?: string; finishedAt?: string
  outputs?: SolverOutput; error?: string; package?: SimulationPackage
}

export const JOB_STORAGE_KEY = 'telaio.simulationJobs.v1'
export const MAX_STORED_JOBS = 30

/** Restores stored jobs. Jobs that were queued or running when the page closed are marked failed. */
export function parseJobs(raw: string | null): Job[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((j) => j && typeof j.id === 'string' && j.solver in SOLVERS).slice(0, MAX_STORED_JOBS).map((j: Job) =>
      j.status === 'queued' || j.status === 'running' ? { ...j, status: 'failed' as const, error: 'Interrupted: the page was closed or reloaded before the job finished', progress: 0 } : j)
  } catch { return [] }
}

/** Keeps the newest jobs within the storage cap, never dropping queued or running ones. */
export function capJobs(jobs: Job[]): Job[] {
  const active = jobs.filter((j) => j.status === 'queued' || j.status === 'running')
  const finished = jobs.filter((j) => !(j.status === 'queued' || j.status === 'running'))
  return [...active, ...finished.slice(0, Math.max(0, MAX_STORED_JOBS - active.length))]
}
