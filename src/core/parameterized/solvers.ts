import { validName } from './template.ts';
import type { Scalar } from './expression.ts';
export interface SolverResult { answers: Record<string, Scalar>; intermediate?: Record<string, Scalar>; explanation?: string; trace?: string[] }
export interface ParameterizedSolver {
  id: string; version: string; label: string; outputs: readonly string[];
  solve(parameters: Readonly<Record<string, Scalar>>): SolverResult;
}
const solvers = new Map<string, ParameterizedSolver>();
export function registerParameterizedSolver(solver: ParameterizedSolver): () => void {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(solver.id) || !solver.version || solvers.has(solver.id) || !solver.outputs.length || solver.outputs.length > 64 ||
      solver.outputs.some(name => !validName(name)) || new Set(solver.outputs).size !== solver.outputs.length) throw new Error('Invalid or duplicate solver registration.');
  solvers.set(solver.id, solver);
  return () => { if (solvers.get(solver.id) === solver) solvers.delete(solver.id); };
}
export function registeredSolvers(): readonly ParameterizedSolver[] { return [...solvers.values()]; }
export function getParameterizedSolver(id: string, version: string): ParameterizedSolver {
  const solver = solvers.get(id);
  if (!solver || solver.version !== version) throw new Error(`Solver ${id} (${version}) is not registered.`);
  return solver;
}

export function solverMetadata(reference: { id: string; version: string; package?: import('./solver-package.ts').SolverPackage }): { id: string; version: string; label: string; outputs: readonly string[] } {
  if (reference.package) return { id: reference.id, version: reference.version, label: reference.package.label, outputs: reference.package.outputs };
  return getParameterizedSolver(reference.id, reference.version);
}
