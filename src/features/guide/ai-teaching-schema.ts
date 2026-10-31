import { createId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';
import { validateGenerationRules } from '../../core/parameterized/template.ts';
import { validateTeachingLesson, type TeachingBlock, type TeachingLesson, type TeachingChoice } from './teaching-blocks.ts';

/** AI interchange intentionally uses no persisted IDs; only local index references. */
function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(label + ' must be an object.');
  return value;
}
function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(label + ' has unknown fields.');
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 10000)
    throw new Error(label + ' must be nonempty text (up to 10000 characters).');
  return value.trim();
}
function optional(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 10000) throw new Error(label + ' is invalid.');
  return value.trim();
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(label + ' must be an array.');
  return value as unknown[];
}
function words(value: unknown, label: string): string[] {
  return array(value, label).map((entry, i) => text(entry, label + ' ' + (i + 1)));
}
function choices(value: unknown, label: string): TeachingChoice[] {
  return array(value, label).map((entry, index) => {
    const choice = record(entry, label + ' option ' + (index + 1));
    keys(choice, ['label', 'explanation'], label);
    return { id: createId(), label: text(choice.label, label + ' label'),
      explanation: text(choice.explanation, label + ' explanation') };
  });
}
function blocks(raw: unknown): TeachingBlock[] {
  const sources = array(raw, 'Teaching blocks');
  if (!sources.length || sources.length > 80) throw new Error('A lesson needs 1–80 teaching blocks.');
  return sources.map((source, index): TeachingBlock => {
    const value = record(source, 'Teaching block ' + (index + 1));
    const label = 'Teaching block ' + (index + 1);
    const id = createId(), title = text(value.title, label + ' title');
    switch (value.kind) {
      case 'explanation':
        keys(value, ['kind','title','body','highlights'], label);
        return { id, kind: 'explanation', title, body: text(value.body, label + ' body'),
          ...(value.highlights === undefined ? {} : { highlights: words(value.highlights, label + ' highlights') }) };
      case 'example':
        keys(value, ['kind','title','scenario','steps','takeaway'], label);
        return { id, kind: 'example', title, scenario: text(value.scenario, label + ' scenario'),
          steps: words(value.steps, label + ' steps'), takeaway: text(value.takeaway, label + ' takeaway') };
      case 'parameterized':
        keys(value, ['kind','title','prompt','steps','takeaway','rules'], label);
        validateGenerationRules(value.rules);
        // Generated instructional data may provide expression rules but never
        // executable uploaded solver packages. Trusted registry solvers remain app-owned.
        if (value.rules.solver?.package)
          throw new Error(label + ' cannot import an executable solver package from AI.');
        return { id, kind: 'parameterized', title,
          prompt: text(value.prompt, label + ' prompt'),
          steps: words(value.steps, label + ' steps'),
          takeaway: text(value.takeaway, label + ' takeaway'),
          rules: value.rules };
      case 'comparison': {
        keys(value, ['kind','title','left','right'], label);
        function side(source: unknown, name: string) {
          const v = record(source, label + ' ' + name);
          keys(v, ['label','description','points'], label + ' ' + name);
          return { label: text(v.label, label + ' ' + name), description: text(v.description, label + ' description'),
            points: words(v.points, label + ' points') };
        }
        return { id, kind: 'comparison', title, left: side(value.left, 'left'), right: side(value.right, 'right') };
      }
      case 'table':
        keys(value, ['kind','title','caption','headers','rows'], label);
        return { id, kind: 'table', title, caption: optional(value.caption, label + ' caption'),
          headers: words(value.headers, label + ' headers'),
          rows: array(value.rows, label + ' rows').map((row, n) =>
            array(row, label + ' row ' + (n + 1)).map((cell, column) => {
              if (typeof cell !== 'string') throw new Error(label + ' cell ' + (n + 1) + ':' + (column + 1) + ' must be text.');
              return cell;
            })) };
      case 'sequence':
        keys(value, ['kind','title','intro','steps'], label);
        return { id, kind: 'sequence', title, intro: optional(value.intro, label + ' intro'),
          steps: array(value.steps, label + ' steps').map((entry, n) => {
            const step = record(entry, label + ' step ' + (n + 1));
            keys(step, ['title','body'], label + ' step');
            return { title: text(step.title, label + ' step title'), body: text(step.body, label + ' step body') };
          }) };
      case 'diagram':
        keys(value, ['kind','title','caption','nodes'], label);
        return { id, kind: 'diagram', title, caption: optional(value.caption, label + ' caption'),
          nodes: array(value.nodes, label + ' nodes').map((entry, n) => {
            const node = record(entry, label + ' node ' + (n + 1));
            keys(node, ['label','detail'], label + ' node');
            return { id: createId(), label: text(node.label, label + ' node label'),
              detail: text(node.detail, label + ' node detail') };
          }) };
      case 'exploration':
        keys(value, ['kind','title','prompt','choices'], label);
        return { id, kind: 'exploration', title, prompt: text(value.prompt, label + ' prompt'),
          choices: choices(value.choices, label) };
      case 'check': {
        keys(value, ['kind','title','question','options','correctIndex'], label);
        const options = choices(value.options, label);
        if (!Number.isInteger(value.correctIndex) || Number(value.correctIndex) < 0 ||
            Number(value.correctIndex) >= options.length)
          throw new Error(label + ' correctIndex must be a zero-based answer index.');
        return { id, kind: 'check', title, question: text(value.question, label + ' question'),
          options, correctId: options[Number(value.correctIndex)].id };
      }
      case 'connection':
        keys(value, ['kind','title','body','next'], label);
        return { id, kind: 'connection', title, body: text(value.body, label + ' body'),
          next: optional(value.next, label + ' next') };
      default: throw new Error(label + ' has an unsupported kind.');
    }
  });
}

export function parseAiTeachingLesson(value: unknown): TeachingLesson {
  const input = record(value, 'Teaching lesson');
  keys(input, ['version', 'blocks'], 'Teaching lesson');
  if (input.version !== 1) throw new Error('A Teaching lesson must use version 1.');
  const lesson: TeachingLesson = { version: 1, blocks: blocks(input.blocks) };
  validateTeachingLesson(lesson, new Set<string>());
  return lesson;
}
