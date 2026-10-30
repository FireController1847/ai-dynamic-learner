import { isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';
import type { MapTopic } from './library-model.ts';

/**
 * Declarative, offline-safe lesson data. Longer text is rendered as sanitized
 * Markdown with KaTeX; short labels render text and trusted-disabled KaTeX only.
 * The schema contains no executable HTML, scripts, or arbitrary renderers.
 */
export type TeachingBlock =
  | { id: string; kind: 'explanation'; title: string; body: string; highlights?: string[] }
  | { id: string; kind: 'example'; title: string; scenario: string; steps: string[]; takeaway: string }
  | { id: string; kind: 'comparison'; title: string; left: TeachingSide; right: TeachingSide }
  | { id: string; kind: 'sequence'; title: string; intro?: string; steps: TeachingStep[] }
  | { id: string; kind: 'diagram'; title: string; caption?: string; nodes: TeachingNode[] }
  | { id: string; kind: 'exploration'; title: string; prompt: string; choices: TeachingChoice[] }
  | { id: string; kind: 'check'; title: string; question: string; options: TeachingChoice[]; correctId: string }
  | { id: string; kind: 'connection'; title: string; body: string; next?: string };

export interface TeachingSide { label: string; description: string; points: string[] }
export interface TeachingStep { title: string; body: string }
export interface TeachingNode { id: string; label: string; detail: string }
export interface TeachingChoice { id: string; label: string; explanation: string }
export interface TeachingLesson { version: 1; blocks: TeachingBlock[] }

export const MAX_TEACHING_BLOCKS = 80;
const MAX_LESSON_TEXT = 10000;

function strictKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(label + ' has unrecognized fields.');
}
function requiredText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_LESSON_TEXT)
    throw new Error(label + ' must contain valid text.');
}
function optionalText(value: unknown, label: string) {
  if (value !== undefined && (typeof value !== 'string' || value.length > MAX_LESSON_TEXT))
    throw new Error(label + ' is invalid.');
}
function strings(value: unknown, max: number, label: string, min = 0): asserts value is string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error(label + ' has an invalid number of entries.');
  value.forEach((entry, index) => requiredText(entry, label + ' ' + (index + 1)));
}
function register(value: unknown, ids: Set<string>, label: string): asserts value is string {
  if (!isValidId(value) || ids.has(value)) throw new Error(label + ' ID is invalid or duplicated.');
  ids.add(value);
}
function side(value: unknown, label: string): asserts value is TeachingSide {
  if (!isRecord(value)) throw new Error(label + ' is invalid.');
  strictKeys(value, ['label', 'description', 'points'], label);
  requiredText(value.label, label + ' label');
  requiredText(value.description, label + ' description');
  strings(value.points, 12, label + ' points');
}
function steps(value: unknown, label: string): asserts value is TeachingStep[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 12) throw new Error(label + ' is invalid.');
  value.forEach((entry, index) => {
    if (!isRecord(entry)) throw new Error(label + ' entry is invalid.');
    strictKeys(entry, ['title', 'body'], label);
    requiredText(entry.title, label + ' step ' + (index + 1) + ' title');
    requiredText(entry.body, label + ' step ' + (index + 1) + ' body');
  });
}
function choices(value: unknown, ids: Set<string>, label: string): asserts value is TeachingChoice[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) throw new Error(label + ' is invalid.');
  for (const choice of value) {
    if (!isRecord(choice)) throw new Error(label + ' choice is invalid.');
    strictKeys(choice, ['id', 'label', 'explanation'], label);
    register(choice.id, ids, label + ' choice');
    requiredText(choice.label, label + ' choice label');
    requiredText(choice.explanation, label + ' choice explanation');
  }
}
export function validateTeachingLesson(value: unknown, ids: Set<string>): asserts value is TeachingLesson {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.blocks) ||
      value.blocks.length > MAX_TEACHING_BLOCKS) throw new Error('A Guide lesson is invalid.');
  strictKeys(value, ['version', 'blocks'], 'Lesson');
  for (const block of value.blocks) {
    if (!isRecord(block)) throw new Error('A teaching block is invalid.');
    register(block.id, ids, 'Teaching block');
    requiredText(block.title, 'Teaching block title');
    switch (block.kind) {
      case 'explanation':
        strictKeys(block, ['id','kind','title','body','highlights'], 'Explanation');
        requiredText(block.body, 'Explanation body');
        if (block.highlights !== undefined) strings(block.highlights, 12, 'Highlighted concepts');
        break;
      case 'example':
        strictKeys(block, ['id','kind','title','scenario','steps','takeaway'], 'Example');
        requiredText(block.scenario, 'Example scenario');
        strings(block.steps, 12, 'Example walkthrough', 1);
        requiredText(block.takeaway, 'Example takeaway');
        break;
      case 'comparison':
        strictKeys(block, ['id','kind','title','left','right'], 'Comparison');
        side(block.left, 'Comparison left');
        side(block.right, 'Comparison right');
        break;
      case 'sequence':
        strictKeys(block, ['id','kind','title','intro','steps'], 'Sequence');
        optionalText(block.intro, 'Sequence introduction');
        steps(block.steps, 'Sequence');
        break;
      case 'diagram':
        strictKeys(block, ['id','kind','title','caption','nodes'], 'Diagram');
        optionalText(block.caption, 'Diagram caption');
        if (!Array.isArray(block.nodes) || block.nodes.length < 2 || block.nodes.length > 10)
          throw new Error('Diagram nodes are invalid.');
        for (const node of block.nodes) {
          if (!isRecord(node)) throw new Error('A diagram node is invalid.');
          strictKeys(node, ['id','label','detail'], 'Diagram node');
          register(node.id, ids, 'Diagram node');
          requiredText(node.label, 'Diagram label');
          requiredText(node.detail, 'Diagram detail');
        }
        break;
      case 'exploration':
        strictKeys(block, ['id','kind','title','prompt','choices'], 'Exploration');
        requiredText(block.prompt, 'Exploration prompt');
        choices(block.choices, ids, 'Exploration');
        break;
      case 'check': {
        strictKeys(block, ['id','kind','title','question','options','correctId'], 'Understanding check');
        requiredText(block.question, 'Understanding check question');
        choices(block.options, ids, 'Understanding check');
        if (!block.options.some(option => option.id === block.correctId))
          throw new Error('An understanding check has no matching answer.');
        break;
      }
      case 'connection':
        strictKeys(block, ['id','kind','title','body','next'], 'Connection');
        requiredText(block.body, 'Connection body');
        optionalText(block.next, 'Next topic prompt');
        break;
      default: throw new Error('An unsupported teaching block was found.');
    }
  }
}

/** Existing bullet guides remain readable as complete explanations, never click-to-reveal. */
export function lessonForTopic(topic: MapTopic): TeachingLesson {
  if (topic.lesson) return topic.lesson;
  return {
    version: 1,
    blocks: topic.guide.sections.filter(section => section.title.trim() || section.bullets.some(b => b.trim()))
      .map((section, index): TeachingBlock => ({
        id: 'legacy-' + section.id,
        kind: 'explanation',
        title: section.title.trim() || 'Part ' + (index + 1),
        body: section.bullets.filter(b => b.trim()).join('\n\n') || 'This section has no notes yet.',
      })),
  };
}
