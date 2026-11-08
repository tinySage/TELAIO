import { useCallback, useEffect, useRef, useState } from 'react'
import { capJobs, JOB_STORAGE_KEY, parseJobs, type Job } from './jobs'
import { createPackage } from './packages'
import type { SolverId } from './solvers'

const read = () => { try { return localStorage.getItem(JOB_STORAGE_KEY) } catch { return null } }
const write = (jobs: Job[]) => { try { localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs)) } catch { /* storage full or unavailable */ } }
const newWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

/** FIFO job queue on a Web Worker. Finished jobs are sealed into reproducible packages. */
export function useJobRunner() {
  const [jobs, setJobs] = useState<Job[]>(() => parseJobs(read()))
  const workerRef = useRef<Worker | null>(null)
  const runningRef = useRef<string | null>(null)
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  const update = useCallback((fn: (jobs: Job[]) => Job[]) => {
    setJobs((current) => { const next = capJobs(fn(current)); write(next); return next })
  }, [])

  const attach = useCallback((worker: Worker) => {
    worker.onmessage = async (event: MessageEvent) => {
      const message = event.data as { type: string; jobId: string; fraction?: number; outputs?: Job['outputs']; message?: string }
      if (message.jobId !== runningRef.current) return
      if (message.type === 'progress') update((js) => js.map((j) => j.id === message.jobId ? { ...j, progress: message.fraction ?? j.progress } : j))
      if (message.type === 'error') { runningRef.current = null; update((js) => js.map((j) => j.id === message.jobId ? { ...j, status: 'failed', error: message.message, finishedAt: new Date().toISOString() } : j)) }
      if (message.type === 'done') {
        const job = jobsRef.current.find((j) => j.id === message.jobId)
        const pkg = job && message.outputs ? await createPackage(job.name, job.solver, job.inputs, message.outputs) : undefined
        runningRef.current = null
        update((js) => js.map((j) => j.id === message.jobId ? { ...j, status: 'done', progress: 1, outputs: message.outputs, package: pkg, finishedAt: new Date().toISOString() } : j))
      }
    }
    worker.onerror = (event) => {
      const id = runningRef.current; runningRef.current = null
      if (id) update((js) => js.map((j) => j.id === id ? { ...j, status: 'failed', error: event.message || 'Worker error', finishedAt: new Date().toISOString() } : j))
    }
  }, [update])

  useEffect(() => {
    const worker = newWorker(); attach(worker); workerRef.current = worker
    return () => worker.terminate()
  }, [attach])

  // Start the next queued job whenever the worker is idle.
  useEffect(() => {
    if (runningRef.current || !workerRef.current) return
    const next = [...jobs].reverse().find((j) => j.status === 'queued')
    if (!next) return
    runningRef.current = next.id
    update((js) => js.map((j) => j.id === next.id ? { ...j, status: 'running', startedAt: new Date().toISOString() } : j))
    workerRef.current.postMessage({ type: 'run', jobId: next.id, solver: next.solver, inputs: next.inputs })
  }, [jobs, update])

  const submit = useCallback((name: string, solver: SolverId, inputs: unknown) => {
    const job: Job = { id: 'job-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, solver, inputs: structuredClone(inputs), status: 'queued', progress: 0, createdAt: new Date().toISOString() }
    update((js) => [job, ...js])
    return job.id
  }, [update])

  const cancel = useCallback((id: string) => {
    if (runningRef.current === id && workerRef.current) {
      workerRef.current.terminate(); runningRef.current = null
      const worker = newWorker(); attach(worker); workerRef.current = worker
    }
    update((js) => js.map((j) => j.id === id && (j.status === 'queued' || j.status === 'running') ? { ...j, status: 'cancelled', finishedAt: new Date().toISOString() } : j))
  }, [attach, update])

  const remove = useCallback((id: string) => update((js) => js.filter((j) => j.id !== id || j.status === 'running')), [update])

  return { jobs, submit, cancel, remove }
}
