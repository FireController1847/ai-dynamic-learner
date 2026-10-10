import { evaluateExpression, parseExpression, type Scalar } from './expression.ts';
import { generatedAnswerCorrect, formatAnswer, type GeneratedAnswer } from './answers.ts';
import { seededRandom } from './random.ts';
import { runUploadedSolver } from './solver-sandbox.ts';
import { validateSolverResult } from './solver-package.ts';
import { getParameterizedSolver, solverMetadata, type SolverResult } from './solvers.ts';
import { dependencies, dependencyOrder, validateGenerationRules, validateTexts, type GenerationRules, type QuestionTemplate } from './template.ts';
export interface GeneratedVariant { version: 1; seed: string; attempt: number; values: Record<string, Scalar>; texts: Record<string, string>; answers: GeneratedAnswer[]; choices: string[]; trace: string[] }
export function validateTemplate(template: QuestionTemplate): void {
  const { texts, ...rules } = template;
  validateGenerationRules(rules);
  const variables = template.variables.map(variable => ({ name: variable.name, dependencies: variable.kind === 'derived' ? dependencies(variable.expression) : [] }));
  dependencyOrder(variables);
  const variableNames = variables.map(variable => variable.name);
  for (const constraint of template.constraints) dependencyOrder([{ name: '$constraint', dependencies: dependencies(constraint) }], variableNames);
  const outputs = template.solver ? solverMetadata(template.solver).outputs : [];
  if (outputs.some(name => variableNames.includes(name) || template.answers.some(answer => answer.key === name))) throw new Error('Solver output names collide with variable or answer keys.');
  for (const source of Object.values(template.solver?.parameters ?? {})) dependencyOrder([{ name: '$parameter', dependencies: dependencies(source) }], variableNames);
  const answers = template.answers.map(answer => ({ name: answer.key, dependencies: answer.expression ? dependencies(answer.expression) : [] }));
  dependencyOrder(answers, [...variableNames, ...outputs]);
  for (const answer of template.answers) {
    if (answer.solverKey && !outputs.includes(answer.solverKey)) throw new Error(`Unknown solver output: ${answer.solverKey}.`);
    if (answer.expression && !dependencies(answer.expression).length) throw new Error('Correct answers must depend on generated values.');
  }
  const names = [...variableNames, ...outputs, ...answers.map(answer => answer.name)];
  validateTexts({ ...texts, ...Object.fromEntries(template.answers.map(answer => [`label:${answer.key}`, answer.label])) }, names);
  for (const source of template.distractors ?? []) dependencyOrder([{ name: '$choice', dependencies: dependencies(source) }], names);
}
interface SolverRequest { reference: NonNullable<GenerationRules['solver']>; parameters: Readonly<Record<string, Scalar>> }
function* generation(template: QuestionTemplate, seed: string): Generator<SolverRequest, GeneratedVariant, SolverResult> {
  validateTemplate(template);
  if (!seed || seed.length > 128) throw new Error('Use a seed of 1–128 characters.');
  const random = seededRandom(seed);
  const variableOrder = dependencyOrder(template.variables.map(variable => ({ name: variable.name, dependencies: variable.kind === 'derived' ? dependencies(variable.expression) : [] })));
  let lastProblem = '';
  for (let attempt = 0; attempt < 128; attempt++) {
    try {
      const values: Record<string, Scalar> = {};
      for (const name of variableOrder) {
        const variable = template.variables.find(entry => entry.name === name)!;
        if (variable.kind === 'choice') values[name] = variable.values[Math.floor(random() * variable.values.length)]!;
        else if (variable.kind === 'derived') values[name] = evaluateExpression(parseExpression(variable.expression), values);
        else {
          const factor = variable.kind === 'decimal' ? 10 ** (variable.precision ?? 2) : 1;
          const min = Math.ceil(variable.min * factor), max = Math.floor(variable.max * factor);
          if (min > max) throw new Error(`No representable values for ${name}.`);
          values[name] = (min + Math.floor(random() * (max - min + 1))) / factor;
        }
      }
      if (template.constraints.some(source => evaluateExpression(parseExpression(source), values) !== true)) continue;
      let trace: string[] = [], solverExplanation = '';
      if (template.solver) {
        const solver = solverMetadata(template.solver);
        const parameters = Object.fromEntries(Object.entries(template.solver.parameters).map(([key, source]) => [key, evaluateExpression(parseExpression(source), values)]));
        const result = yield { reference: template.solver, parameters: Object.freeze(parameters) }; trace = result.trace ?? []; solverExplanation = result.explanation ?? '';
        for (const name of solver.outputs) {
          if (Object.hasOwn(result.answers, name) && result.intermediate && Object.hasOwn(result.intermediate, name)) throw new Error(`Solver output is declared twice: ${name}.`);
          const value = result.intermediate?.[name] ?? result.answers[name];
          if (value === undefined || typeof value === 'string' && value.length > 12000 || typeof value === 'number' && !Number.isFinite(value) || !['number','string','boolean'].includes(typeof value)) throw new Error(`Invalid solver output: ${name}.`);
          values[name] = value;
        }
      }
      const answerOrder = dependencyOrder(template.answers.map(answer => ({ name: answer.key, dependencies: answer.expression ? dependencies(answer.expression) : [] })), Object.keys(values));
      const answersByKey = new Map<string, GeneratedAnswer>();
      for (const key of answerOrder) {
        const definition = template.answers.find(answer => answer.key === key)!;
        const value = definition.expression ? evaluateExpression(parseExpression(definition.expression), values) : values[definition.solverKey!];
        if (value === undefined) throw new Error(`Missing computed answer: ${key}.`);
        const answer = formatAnswer(definition, value); values[key] = answer.value; answersByKey.set(key, answer);
      }
      const interpolate = (text: string) => text.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)(?::([0-8]))?\}\}/g, (_match, name: string, precision: string | undefined) => {
        if (answersByKey.has(name)) return answersByKey.get(name)!.text;
        if (precision !== undefined && typeof values[name] === 'number') return (values[name] as number).toFixed(Number(precision));
        return answersByKey.get(name)?.text ?? String(values[name]);
      });
      const answers = template.answers.map(answer => ({ ...answersByKey.get(answer.key)!, label: interpolate(answer.label) }));
      const texts = Object.fromEntries(Object.entries(template.texts).map(([key, text]) => [key, interpolate(text)]));
      if (!texts.explanation && solverExplanation) texts.explanation = solverExplanation;
      if (trace.length > 1000 || trace.some(line => typeof line !== 'string' || line.length > 12000)) throw new Error('Solver trace exceeds limits.');
      const distractors = (template.distractors ?? []).map(source => {
        const value = evaluateExpression(parseExpression(source), values);
        return typeof value === 'number' && answers.length === 1 ? formatAnswer(template.answers[0]!, value).text : String(value);
      });
      const choices = [...answers.map(answer => answer.text), ...distractors].map(choice => choice.trim());
      if (answers.length === 1 && template.distractors?.length && (new Set(choices).size !== choices.length ||
          distractors.some(choice => generatedAnswerCorrect(answers[0]!, choice)))) throw new Error('A distractor matches the correct answer or another option.');
      return { version: 1, seed, attempt, values, texts, answers, choices, trace };
    } catch (error) { lastProblem = error instanceof Error ? error.message : String(error); }
  }
  throw new Error(`Unable to generate a valid variant after 128 attempts. Check constraints, ranges, or computed choices. ${lastProblem}`);
}

/** Synchronous entry point remains available for trusted application solvers. */
export function generateVariant(template: QuestionTemplate, seed: string): GeneratedVariant {
  const procedure = generation(template, seed);
  let step = procedure.next();
  while (!step.done) {
    const { reference, parameters } = step.value;
    if (reference.package) throw new Error('Uploaded solvers require asynchronous generation.');
    const solver = getParameterizedSolver(reference.id, reference.version);
    const result = solver.solve(parameters); validateSolverResult(result, solver.outputs);
    step = procedure.next(result);
  }
  return step.value;
}
export async function generateVariantAsync(template: QuestionTemplate, seed: string, signal?: AbortSignal): Promise<GeneratedVariant> {
  const procedure = generation(template, seed);
  const beginning = Date.now();
  let step = procedure.next();
  while (!step.done) {
    if (signal?.aborted) throw new Error('Question generation canceled.');
    if (Date.now() - beginning > 10000) throw new Error('Question exceeded its generation time limit.');
    const { reference, parameters } = step.value;
    const result = reference.package ? await runUploadedSolver(reference.package, parameters, signal) :
      getParameterizedSolver(reference.id, reference.version).solve(parameters);
    validateSolverResult(result, solverMetadata(reference).outputs);
    step = procedure.next(result);
  }
  return step.value;
}
