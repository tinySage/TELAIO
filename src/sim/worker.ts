/// <reference lib="webworker" />
/** Runs solvers off the main thread. One job at a time; cancellation terminates the worker. */
import { runSolver, type SolverId } from './solvers'

type RunMessage = { type: 'run'; jobId: string; solver: SolverId; inputs: unknown }

self.onmessage = (event: MessageEvent<RunMessage>) => {
  const { jobId, solver, inputs } = event.data
  try {
    const outputs = runSolver(solver, inputs, (fraction) => self.postMessage({ type: 'progress', jobId, fraction }))
    self.postMessage({ type: 'done', jobId, outputs })
  } catch (error) {
    self.postMessage({ type: 'error', jobId, message: error instanceof Error ? error.message : String(error) })
  }
}
