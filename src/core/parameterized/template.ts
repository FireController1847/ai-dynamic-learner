import { validateSolverPackage, type SolverPackage } from './solver-package.ts';
import { isRecord } from '../validation.ts';
import { parseExpression, expressionDependencies, type Scalar } from './expression.ts';
export type VariableDefinition = { name: string } & (
  { kind: 'integer' | 'decimal'; min: number; max: number; precision?: number } |
  { kind: 'choice'; values: Scalar[] } | { kind: 'derived'; expression: string });
export interface AnswerDefinition {
  key: string; label: string; expression?: string; solverKey?: string;
  matching: 'numeric' | 'exact'; precision?: number; rounding?: 'round' | 'floor' | 'ceil'; absoluteTolerance?: number; relativeTolerance?: number;
}
export interface GenerationRules {
  version: 1; variables: VariableDefinition[]; constraints: string[]; answers: AnswerDefinition[];
  distractors?: string[]; solver?: { id: string; version: string; parameters: Record<string, string>; package?: SolverPackage };
}
export interface QuestionTemplate extends GenerationRules { texts: Record<string, string> }
export function validName(name: string): boolean { return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) && !['true', 'false', 'constructor', 'prototype'].includes(name); }
function text(value: unknown): value is string { return typeof value === 'string' && value.length <= 2000; }
function scalar(value: unknown): value is Scalar { return typeof value === 'string' && value.length <= 2000 || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value); }
export function validateGenerationRules(value: unknown): asserts value is GenerationRules {
  if (!isRecord(value) || value.version !== 1 || Object.keys(value).some(key => !['version','variables','constraints','answers','distractors','solver'].includes(key)) ||
      !Array.isArray(value.variables) || !value.variables.length || value.variables.length > 32 ||
      !Array.isArray(value.constraints) || value.constraints.length > 32 || !value.constraints.every(text) ||
      !Array.isArray(value.answers) || !value.answers.length || value.answers.length > 20) throw new Error('Invalid generation rules: use 1–32 variables and 1–20 answers.');
  const names = new Set<string>();
  const variables: unknown[] = value.variables;
  for (const variable of variables) {
    if (!isRecord(variable) || typeof variable.name !== 'string' || !validName(variable.name) || names.has(variable.name)) throw new Error('Variable names must be unique identifiers.');
    names.add(variable.name);
    const keys = variable.kind === 'choice' ? ['name','kind','values'] : variable.kind === 'derived' ? ['name','kind','expression'] : ['name','kind','min','max','precision'];
    if (Object.keys(variable).some(key => !keys.includes(key))) throw new Error('Unsupported variable fields.');
    if (variable.kind === 'choice') {
      if (!Array.isArray(variable.values) || !variable.values.length || variable.values.length > 100 || !variable.values.every(scalar)) throw new Error('Choice variables need 1–100 scalar values.');
    } else if (variable.kind === 'derived') {
      if (!text(variable.expression)) throw new Error('Derived variables need expressions.');
      parseExpression(variable.expression);
    } else if (variable.kind === 'integer' || variable.kind === 'decimal') {
      if (typeof variable.min !== 'number' || typeof variable.max !== 'number' || !Number.isFinite(variable.min) || !Number.isFinite(variable.max) || variable.min > variable.max ||
          Math.abs(variable.min) > 1e9 || Math.abs(variable.max) > 1e9 ||
          (variable.kind === 'integer' && (!Number.isInteger(variable.min) || !Number.isInteger(variable.max))) ||
          (variable.precision !== undefined && (typeof variable.precision !== 'number' || !Number.isInteger(variable.precision) || variable.precision < 0 || variable.precision > 6))) throw new Error('Invalid numeric variable range or precision.');
    } else throw new Error('Unknown variable generation kind.');
  }
  const answers: unknown[] = value.answers;
  for (const answer of answers) {
    if (!isRecord(answer) || Object.keys(answer).some(key => !['key','label','expression','solverKey','matching','precision','rounding','absoluteTolerance','relativeTolerance'].includes(key)) ||
        typeof answer.key !== 'string' || !validName(answer.key) || names.has(answer.key) || !text(answer.label) || !answer.label.trim() ||
        !['numeric','exact'].includes(String(answer.matching)) ||
        (typeof answer.expression === 'string') === (typeof answer.solverKey === 'string')) throw new Error('Answers need unique keys, labels, and exactly one expression or solver output.');
    names.add(answer.key);
    if (answer.expression !== undefined) { if (!text(answer.expression)) throw new Error('Invalid answer expression.'); parseExpression(answer.expression); }
    if (answer.solverKey !== undefined && (typeof answer.solverKey !== 'string' || !validName(answer.solverKey) || !value.solver)) throw new Error('Solver answers need a registered solver output key.');
    if (answer.precision !== undefined && (typeof answer.precision !== 'number' || !Number.isInteger(answer.precision) || answer.precision < 0 || answer.precision > 8)) throw new Error('Answer precision must be 0–8.');
    if (answer.rounding !== undefined && !['round','floor','ceil'].includes(String(answer.rounding))) throw new Error('Unknown rounding method.');
    for (const key of ['absoluteTolerance','relativeTolerance']) if (answer[key] !== undefined && (typeof answer[key] !== 'number' || !Number.isFinite(answer[key]) || answer[key] < 0)) throw new Error('Tolerances must be finite and non-negative.');
  }
  if (value.distractors !== undefined && (!Array.isArray(value.distractors) || value.distractors.length > 7 || !value.distractors.every(text))) throw new Error('Use at most seven distractor expressions.');
  if (value.solver !== undefined) {
    if (!isRecord(value.solver) || Object.keys(value.solver).some(key => !['id','version','parameters','package'].includes(key)) || !text(value.solver.id) || !text(value.solver.version) ||
        !isRecord(value.solver.parameters) || Object.keys(value.solver.parameters).length > 32 ||
        Object.entries(value.solver.parameters).some(([key, expression]) => !validName(key) || !text(expression))) throw new Error('Invalid solver configuration.');
    if (value.solver.package !== undefined) {
      validateSolverPackage(value.solver.package);
      if (value.solver.package.id !== value.solver.id || value.solver.package.solverVersion !== value.solver.version) throw new Error('Solver package identity does not match its reference.');
    }
  }
}
export function dependencyOrder(definitions: readonly { name: string; dependencies: readonly string[] }[], external: readonly string[] = []): string[] {
  const known = new Map(definitions.map(value => [value.name, value]));
  const done = new Set(external), visiting = new Set<string>(), order: string[] = [];
  function visit(name: string) {
    if (done.has(name)) return;
    const entry = known.get(name);
    if (!entry) throw new Error(`Unresolved dependency: ${name}.`);
    if (visiting.has(name)) throw new Error(`Circular dependency involving ${name}.`);
    visiting.add(name); entry.dependencies.forEach(visit); visiting.delete(name); done.add(name); order.push(name);
  }
  definitions.forEach(entry => visit(entry.name));
  return order;
}
export function validateTexts(texts: Record<string, string>, names: readonly string[]): void {
  if (!isRecord(texts) || Object.keys(texts).length > 128) throw new Error('Invalid template text regions.');
  for (const value of Object.values(texts)) {
    if (typeof value !== 'string') throw new Error('Template regions must be text.');
    if (value.length > 12000) throw new Error('Template text is too long.');
    const rest = value.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)(?::([0-8]))?\}\}/g, (_match, name: string) => {
      if (!names.includes(name)) throw new Error(`Unresolved placeholder: ${name}.`); return '';
    });
    if (/\{\{|\}\}/.test(rest)) throw new Error('Malformed variable placeholder.');
  }
}
export const dependencies = (source: string) => expressionDependencies(parseExpression(source));
