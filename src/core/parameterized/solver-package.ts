import { isRecord } from '../validation.ts';
import { validName } from './template.ts';
import type { Scalar } from './expression.ts';
import type { SolverResult } from './solvers.ts';
export const SOLVER_PACKAGE_FORMAT = 'dynamic-learner-solver';
export const MAX_SOLVER_SOURCE = 64 * 1024;
export interface SolverPackage {
  format: typeof SOLVER_PACKAGE_FORMAT; version: 1;
  id: string; solverVersion: string; label: string; outputs: string[]; source: string;
}
export function validateSolverPackage(value: unknown): asserts value is SolverPackage {
  if (!isRecord(value) || value.format !== SOLVER_PACKAGE_FORMAT || value.version !== 1 ||
      Object.keys(value).some(key => !['format','version','id','solverVersion','label','outputs','source'].includes(key)) ||
      typeof value.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value.id) ||
      typeof value.solverVersion !== 'string' || !value.solverVersion.trim() || value.solverVersion.length > 64 ||
      typeof value.label !== 'string' || !value.label.trim() || value.label.length > 200 ||
      !Array.isArray(value.outputs) || !value.outputs.length || value.outputs.length > 64 ||
      value.outputs.some(name => typeof name !== 'string' || !validName(name)) || new Set(value.outputs).size !== value.outputs.length ||
      typeof value.source !== 'string' || !value.source.trim() || value.source.length > MAX_SOLVER_SOURCE) {
    throw new Error('Upload a version-1 dynamic-learner-solver JSON package with metadata, output names, and a JavaScript function source.');
  }
}
function scalar(value: unknown): value is Scalar {
  return typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || typeof value === 'string' && value.length <= 12000;
}
export function validateSolverResult(value: unknown, outputs: readonly string[]): asserts value is SolverResult {
  if (!isRecord(value) || Object.keys(value).some(key => !['answers','intermediate','explanation','trace'].includes(key)) ||
      !isRecord(value.answers) || value.intermediate !== undefined && !isRecord(value.intermediate) ||
      value.explanation !== undefined && (typeof value.explanation !== 'string' || value.explanation.length > 2000) ||
      value.trace !== undefined && (!Array.isArray(value.trace) || value.trace.length > 1000 || value.trace.some(line => typeof line !== 'string' || line.length > 12000))) throw new Error('Solver returned invalid answers, explanation, or trace.');
  const answers = value.answers;
  const intermediate = value.intermediate ?? {};
  for (const map of [answers, intermediate]) {
    if (Object.entries(map).some(([name, result]) => !outputs.includes(name) || !scalar(result))) throw new Error('Solver returned an undeclared or invalid output.');
  }
  if (outputs.some(name => Object.hasOwn(answers, name) === Object.hasOwn(intermediate, name))) throw new Error('Every declared solver output must appear exactly once in answers or intermediate.');
}

export function sameSolverPackage(left: SolverPackage, right: SolverPackage): boolean {
  const signature = (pkg: SolverPackage) => JSON.stringify([pkg.id, pkg.solverVersion, pkg.label, pkg.outputs, pkg.source]);
  return signature(left) === signature(right);
}
