import { isRecord } from '../../core/validation.ts';
import { sameSolverPackage, validateSolverPackage, type SolverPackage } from '../../core/parameterized/solver-package.ts';
import { validateParameterization, type Parameterization } from './parameterized-model.ts';

export const AI_SOLVER_EXAMPLE: SolverPackage = {
  format: 'dynamic-learner-solver', version: 1, id: 'combine-values', solverVersion: '1', label: 'Combine values', outputs: ['computedTotal'],
  source: 'function solve(parameters) { const { left, right } = parameters; if (typeof left !== "number" || typeof right !== "number") throw new Error("Numeric inputs required"); return { answers: { computedTotal: left + right }, explanation: `${left} + ${right} = ${left + right}.` }; }',
};
export const AI_PARAMETERIZED_EXAMPLE = {
  type: 'parameterized', prompt: 'What is {{a}} + {{b}}?', explanation: '{{a}} + {{b}} = {{result}}.',
  parameters: { presentation: 'fields', rules: { version: 1,
    variables: [{ name: 'a', kind: 'integer', min: 1, max: 10 }, { name: 'b', kind: 'integer', min: 1, max: 10 }],
    constraints: [], solver: { id: AI_SOLVER_EXAMPLE.id, version: '1', parameters: { left: 'a', right: 'b' } },
    answers: [{ key: 'result', label: 'Your answer', solverKey: 'computedTotal', matching: 'numeric', precision: 0 }],
  } },
};
export const PARAMETERIZED_AI_GUIDANCE = `
Parameterized questions:
- Use type "parameterized" with prompt, optional context/explanation, and "parameters". Never supply a fixed top-level answer or choices. Count each template as one question, regardless of answer fields. Choose source-grounded scenarios that benefit from genuinely changing values; do not randomly mutate historical facts or other fixed source facts.
- parameters has "presentation": "fields", "multiple-choice", "true-false", "fill-in-the-blanks", or "dropdown", plus "rules" and optional matching "rows". Prefer generated multiple choice where practical, and keep typed answers very short. Numeric fields may require several independent outputs when the scenario calls for them.
- rules has version 1, variables, constraints, answers, optional distractors, and an optional solver reference. Integer/decimal variables use name/kind/min/max and optional precision (0–6). Choice variables use name/kind/values (scalar strings, numbers, booleans). Derived variables use name/kind/expression. Declare 1–32 variables, 1–20 answers. Ranges are inclusive. Constraints must return true and be realistically satisfiable, with plenty of valid variants.
- Answers have unique key, concise label, matching "numeric" or "exact", and exactly one "expression" or "solverKey". Numeric answers may set precision (0–8), rounding "round"/"floor"/"ceil", absoluteTolerance, relativeTolerance (0.01 means 1%). All answers must be computed from the generated inputs. Answer dependencies use rounded preceding answers; use derived values for full-precision intermediates.
- Use {{name}} and {{name:2}} placeholders in prompt/context/explanation/labels. Do not reveal computed answers in prompt/context. For generated blanks use [[answerKey]] in the prompt; {{variable}} means a visible value, never a hidden blank. Keep blanks almost always one word; separate multiple items with [[first]] and [[second]] or [[first]] or [[second]].
- Generated multiple choice needs exactly one answer and 1–7 distractor expressions, with 2–8 distinct options; distractors must remain wrong after rounding/tolerance. True/false needs one boolean answer expression with matching "exact". Dropdown uses rows of {label,answerKey}, a shared set of distinct computed choices, and optional distractors (2–20 choices). Rows and labels must be distinct and meaningful.
- Safe expressions support + - * / % ^, parentheses, == != < > <= >=, && ||, unary ! + -, scalar literals, and abs/min/max/sqrt/pow/round/floor/ceil/trunc/sign/log/log10/exp/sin/cos/tan. No JavaScript, property access, arrays, ternaries, or arbitrary functions inside expressions. All referenced names must be defined; no cycles.
- For algorithms that exceed these expressions, PROVIDE the solver yourself in the response's optional top-level "solvers" array. Each package has format "dynamic-learner-solver", version 1, id (lowercase letter followed by letters/digits/hyphens), solverVersion (a nonempty string), label, outputs (unique identifier names), and source (one plain JavaScript function expression as a JSON string). No TypeScript annotations, imports, exports, dependencies, markdown fences inside source, or calls to registerParameterizedSolver.
- source is function solve(parameters) { ... return {answers:{outputName:value}, intermediate:{optionalName:value}, explanation:"Optional short explanation", trace:["Optional step"]}; }. Return only finite numbers, strings, or booleans for outputs. Declare ALL answers/intermediates in outputs, each appearing exactly once across those maps. Intermediate/explanation/trace fields are optional. Explanations stay under 2000 characters; source under 65536; trace at most 1000 concise lines.
- Algorithms must be deterministic, pure, and bounded, finishing comfortably within 3 seconds. Never use DOM, storage, network, imports, global messaging, eval/Function, random APIs, Date/time, timers, or additional workers. Inputs are only generated scalar parameters; JSON-encoded structured inputs can be passed as strings when needed. Derive all results from those inputs and include accurate readable steps when helpful.
- Reference a package with rules.solver: {id,version,parameters:{solverInputName:"expression"}}; version must exactly equal package.solverVersion. Use solverKey for its computed answer output; expressions may also reference declared intermediate outputs. Variable names, answer keys, and solver output names must not overlap. Reuse one package for related questions. Include only packages referenced by the response; do not require the user to install application code.
- Prefer plain expressions for simple calculations; omit solver references and solvers when they are unnecessary. For a necessary algorithm, do not replace it with hardcoded answers, canned examples, or a lookup over a few generated inputs. Provide a complete general algorithm for the declared ranges and constraints.
`;
export function parseAiSolvers(value: unknown): SolverPackage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error('AI responses may include at most 20 solver packages.');
  const packages: SolverPackage[] = [], identities = new Set<string>();
  for (const pkg of value as unknown[]) {
    validateSolverPackage(pkg); const identity = `${pkg.id}:${pkg.solverVersion}`;
    if (identities.has(identity)) throw new Error('AI solver packages need unique ID/version pairs.');
    identities.add(identity); packages.push(pkg);
  }
  return packages;
}
export function resolveAiParameters(value: unknown, packages: readonly SolverPackage[]): Parameterization {
  if (!isRecord(value) || !isRecord(value.rules)) throw new Error('Parameterized AI questions need generation rules.');
  const rules = value.rules;
  if (rules.solver !== undefined) {
    if (!isRecord(rules.solver) || Object.keys(rules.solver).some(key => !['id','version','parameters','package'].includes(key))) throw new Error('Invalid AI solver reference.');
    const reference = rules.solver;
    if (reference.package !== undefined) {
      validateSolverPackage(reference.package);
      const topLevel = packages.find(pkg => pkg.id === reference.id && pkg.solverVersion === reference.version);
      if (topLevel && !sameSolverPackage(topLevel, reference.package)) throw new Error('Conflicting AI solver packages share an ID/version.');
    }
    if (reference.package === undefined) {
      const pkg = packages.find(pkg => pkg.id === reference.id && pkg.solverVersion === reference.version);
      if (!pkg) throw new Error('Include the referenced solver in the response solvers array.');
      reference.package = pkg;
    }
  }
  validateParameterization(value); return value;
}
