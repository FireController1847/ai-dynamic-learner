import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { AiPromptExchange, type AiPromptExchangeHandle } from '../../components/ai-prompt-exchange.ts';
import { AiScopeChoices } from '../../components/ai-scope-choices.ts';
import { AiFocusChoices } from '../../components/ai-focus-choices.ts';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { categoryScopedPrompt, type AiCardScope, type AiCardCategories } from '../../core/ai-study-categories.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { AI_COMPLETE_COVERAGE_PROMPT, parseAiSubjectCoverage, type AiSubjectCoverage } from '../../core/ai-subject-coverage.ts';
import { inputValue } from '../../core/dom.ts';
import { isRecord } from '../../core/validation.ts';
import { AI_PLAIN_TEXT_ONLY_GUIDANCE } from '../../core/ai-formatting-guidance.ts';
import { parseAiTeachingLesson } from './ai-teaching-schema.ts';
import { parseAiSolvers } from '../knowledge-check/ai-parameterized-format.ts';
import { GUIDE_CONFIDENCE_PROMPT, GUIDE_CONFIDENCE_EXAMPLE, parseGuideConfidence, type GuideAiConfidence } from './ai-confidence.ts';
import { GuideAiReview } from './ai-review.ts';
import { guideAiTeachingPrompt } from './ai-teaching-prompt.ts';
import { guideAiFileOutputInstructions } from './ai-file-output.ts';
import { GUIDE_AI_FOCUSES, type GuideAiFocus } from './ai-focus.ts';
import { DEFAULT_TEACHING_WEIGHTS, teachingMixProblem, allocateTeachingBlocks, TEACHING_TYPES, rebalanceTeachingWeights, type TeachingMixMode, type TeachingWeights } from './ai-teaching-mix.ts';
import { GUIDE_AI_MAX_SPACED_TOPICS, stopsAreSpaced } from './ai-map-layout.ts';
import type { TeachingLesson } from './teaching-blocks.ts';
import {
  MAP_GRID, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH,
  MAX_BULLETS, MAX_NAME_LENGTH, MAX_SECTIONS, MAX_TEXT_LENGTH, MAX_TOPICS, type GuideMode, type GuideMapPattern,
} from './library-model.ts';

const LIST_IMPORT_FORMAT = 'dynamic-learner-guide';
const MAP_IMPORT_FORMAT = 'dynamic-learner-guide-map';
const LEGACY_LIST_IMPORT_FORMAT = 'dynamic-learner-study-guide';
const LEGACY_MAP_IMPORT_FORMAT = 'dynamic-learner-study-guide-map';
const IMPORT_VERSION = 1;
const TEACHING_IMPORT_VERSION = 2;
const MAX_IMPORT_BULLET_DEPTH = 7;
const JSON_FENCE = '```';

type PromptDetail = 'concise' | 'balanced' | 'detailed';
type PromptCoverage = 'essentials' | 'balanced' | 'comprehensive';
type PromptBulletStyle = 'phrases' | 'thoughts';

export interface GuideAiPromptOptions {
  detail: PromptDetail;
  coverage: PromptCoverage;
  bulletStyle: PromptBulletStyle;
  mixMode?: TeachingMixMode;
  aiFocus?: GuideAiFocus;
  targetBlocks?: number;
  weights?: TeachingWeights;
}

export interface SimpleGuideImportSection {
  title: string;
  bullets: string[];
}

export interface SimpleListGuideImport {
  mode: 'list';
  title: string;
  coverage?: AiSubjectCoverage[];
  confidence: GuideAiConfidence | null;
  sections: SimpleGuideImportSection[];
}

export interface SimpleMapGuideImportTopic {
  key: string;
  title: string;
  description?: string;
  position?: readonly [number, number];
  sections: SimpleGuideImportSection[];
  lesson?: TeachingLesson;
}

export interface SimpleMapGuideImport {
  mode: 'map';
  title: string;
  /** One theme for the full generated map, optional for legacy AI responses. */
  background?: GuideMapPattern;
  coverage?: AiSubjectCoverage[];
  confidence: GuideAiConfidence | null;
  startTopic: string;
  topics: SimpleMapGuideImportTopic[];
  connections: { from: string; to: string }[];
}

export type SimpleGuideImport = SimpleListGuideImport | SimpleMapGuideImport;

const DEFAULT_PROMPT_OPTIONS: GuideAiPromptOptions = {
  detail: 'balanced',
  coverage: 'balanced',
  bulletStyle: 'thoughts',
};

const DETAIL_INSTRUCTIONS: Record<PromptDetail, string> = {
  concise: 'Keep only high-priority material. Aggressively condense and omit secondary detail.',
  balanced: 'Keep high- and moderate-priority material. Be selective: simple points are preferred, and minor details, examples, and edge cases may be omitted.',
  detailed: 'Keep all genuinely useful study material, including lower-priority supporting details, while still writing notes rather than textbook prose.',
};

const COVERAGE_INSTRUCTIONS: Record<PromptCoverage, string> = {
  essentials: 'Cover only the core concepts needed to understand and remember the material.',
  balanced: 'Cover the major ideas plus supporting details that directly help understanding or recall. Do not try to preserve every fact.',
  comprehensive: 'Cover the material broadly, including useful distinctions and supporting details, but skip redundancy and trivia.',
};

const BULLET_STYLE_INSTRUCTIONS: Record<PromptBulletStyle, string> = {
  phrases: 'Write short note fragments or points, usually about 5–10 words. They do not need to be complete sentences and normally should not end with a period.',
  thoughts: 'Write every bullet and sub-bullet as a short, intelligible complete sentence. Keep each sentence brief, focused on one idea, and free of unnecessary clauses or explanation. End each sentence with a period.',
};

function promptIntro(options: GuideAiPromptOptions, mode: GuideMode): string {
  const planning = mode === 'list'
    ? 'Silently organize the source into a logical outline, then classify possible study points as high, moderate, or low priority. Use that planning only to decide the final sections, bullets, and sub-bullets; do not output the planning itself.'
    : 'Silently organize the source into a logical topic structure, then classify possible study points as high, moderate, or low priority. Use that planning only to decide the final topics, paths, sections, and bullets; do not output the planning itself.';
  return `Using the source material I supplied immediately before this instruction, create a Dynamic Learner Guide.

Write in the style of a capable student taking organized notes during class: compact, practical, and easy to scan. This is a guide, not a rewritten textbook or transcript.

${planning}

Selected preferences:
- Detail: ${DETAIL_INSTRUCTIONS[options.detail]}
- Coverage: ${COVERAGE_INSTRUCTIONS[options.coverage]}
- Bullet style: ${BULLET_STYLE_INSTRUCTIONS[options.bulletStyle]}

Condense redundant wording, NEVER omit a source subject or subtopic. If the material exceeds application limits, ask for batches rather than silently dropping topics.
${AI_COMPLETE_COVERAGE_PROMPT}
${GUIDE_CONFIDENCE_PROMPT}
For Guide, coverage itemNumbers are 1-based section indices in List mode and 1-based topic indices in Map mode.

${AI_PLAIN_TEXT_ONLY_GUIDANCE}

Do NOT include citations, references, footnotes, source annotations, source lists, or citation/source URLs anywhere in the response. Do not emit ChatGPT citation markers or content-reference tokens such as :chatgpt-content-reference{...}, :contentReference[...]{...}, or cite.... Omit citations even if the source material contains them. The JSON must contain study content only.`;
}

function listPrompt(options: GuideAiPromptOptions): string {
  return `${promptIntro(options, 'list')}

${guideAiFileOutputInstructions('list')}

Write the following illustrative JSON STRUCTURE into the downloadable file (the fenced example below is NOT the response format):
${JSON_FENCE}json
{
  "format": "${LIST_IMPORT_FORMAT}",
  "version": ${IMPORT_VERSION},
  "title": "Short guide title",
  "coverage": [{ "subject": "Specific source topic", "itemNumbers": [1] }],
  "confidence": ${JSON.stringify(GUIDE_CONFIDENCE_EXAMPLE)},
  "sections": [
    {
      "title": "Major topic",
      "bullets": [
        {
          "text": "Key idea",
          "children": [
            { "text": "Supporting detail" }
          ]
        }
      ]
    }
  ]
}
${JSON_FENCE}

Structure the guide naturally:
- sections = major topics;
- nested "children" = useful sub-points;
- use deeper nesting only when it clarifies relationships;
- preserve important terminology and factual accuracy;
- do not invent unsupported information.

Limits:
- title: 1–${MAX_NAME_LENGTH} characters;
- 1–${MAX_SECTIONS} sections;
- at most ${MAX_BULLETS} total bullets/sub-bullets;
- section titles and bullet text: non-empty plain text, at most ${MAX_TEXT_LENGTH} characters;
- at most ${MAX_IMPORT_BULLET_DEPTH + 1} bullet levels;
- do not generate IDs, layout, groups, maps, or other Dynamic Learner fields.`;
}

function mapPrompt(options: GuideAiPromptOptions): string {
  return guideAiTeachingPrompt(options);
}

export function guideAiPrompt(
  options: GuideAiPromptOptions = DEFAULT_PROMPT_OPTIONS,
  mode: GuideMode = 'list',
  scope: AiCardScope | null = null,
): string {
  const generated = mode === 'map' ? mapPrompt(options) : listPrompt(options);
  // Reuse Review's established category scoping. The original source stays
  // authoritative, while the selected category strictly limits new content.
  return scope ? categoryScopedPrompt(generated, scope,
    mode === 'map' ? 'an interactive Guide topic map and Teaching Blocks' : 'a List-mode Guide') : generated;
}

function parseImportBullet(
  value: unknown,
  depth: number,
  state: { count: number },
  label: string,
): string[] {
  if (depth > MAX_IMPORT_BULLET_DEPTH) {
    throw new Error(`${label} is nested deeper than ${MAX_IMPORT_BULLET_DEPTH + 1} levels.`);
  }
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['text', 'children'].includes(key)) ||
      typeof value.text !== 'string' || !value.text.trim() ||
      value.text.trim().length + depth > MAX_TEXT_LENGTH ||
      (Object.hasOwn(value, 'children') && !Array.isArray(value.children))) {
    throw new Error(`${label} is empty, too long, or invalid.`);
  }

  state.count += 1;
  if (state.count > MAX_BULLETS) {
    throw new Error(`A Guide section set can contain up to ${MAX_BULLETS} bullets and sub-bullets.`);
  }

  const flattened = [`${'\t'.repeat(depth)}${value.text.trim()}`];
  if (Array.isArray(value.children)) {
    value.children.forEach((child, index) => {
      flattened.push(...parseImportBullet(child, depth + 1, state, `${label} child ${index + 1}`));
    });
  }
  return flattened;
}

function parseImportSections(
  value: unknown,
  state: { count: number },
  label: string,
): SimpleGuideImportSection[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_SECTIONS) {
    throw new Error(`${label} must contain 1–${MAX_SECTIONS} sections.`);
  }
  return value.map((section, sectionIndex): SimpleGuideImportSection => {
    if (!isRecord(section) ||
        Object.keys(section).some((key) => !['title', 'bullets'].includes(key)) ||
        typeof section.title !== 'string' || !section.title.trim() ||
        section.title.trim().length > MAX_TEXT_LENGTH ||
        !Array.isArray(section.bullets) || !section.bullets.length) {
      throw new Error(`${label}, section ${sectionIndex + 1} is empty, too long, or invalid.`);
    }
    const bullets = section.bullets.flatMap((bullet, bulletIndex) =>
      parseImportBullet(bullet, 0, state, `${label}, section ${sectionIndex + 1}, bullet ${bulletIndex + 1}`));
    return { title: section.title.trim(), bullets };
  });
}

function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = /^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

function stripAiCitationArtifacts(text: string): string {
  return text
    .replace(/:chatgpt-content-reference\{[^{}]*\}/gi, '')
    .replace(/:contentReference\[[^\]]*\]\{[^{}]*\}/gi, '')
    .replace(/(?:cite|filecite|url|memcite)[^]*/g, '')
    .replace(/memcite/g, '');
}

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(stripAiCitationArtifacts(stripJsonCodeFence(text)));
  } catch {
    throw new Error('The response is not in the expected format. Ask the AI to send just the requested structured data.');
  }
}

function parseListImport(value: unknown): SimpleListGuideImport {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'sections', 'coverage', 'confidence'].includes(key)) ||
      (value.format !== LIST_IMPORT_FORMAT && value.format !== LEGACY_LIST_IMPORT_FORMAT) || value.version !== IMPORT_VERSION ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH) {
    throw new Error('This is not a supported List-mode Guide import.');
  }
  const state = { count: 0 };
  return {
    mode: 'list',
    title: value.title.trim(),
    sections: parseImportSections(value.sections, state, 'Guide'),
    confidence: parseGuideConfidence(value.confidence),
    coverage: value.coverage === undefined ? undefined : parseAiSubjectCoverage(value.coverage, Array.isArray(value.sections) ? value.sections.length : 0),
  };
}

function parseMapImport(value: unknown): SimpleMapGuideImport {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'startTopic', 'topics', 'connections', 'coverage', 'confidence', 'solvers', 'background'].includes(key)) ||
      (value.format !== MAP_IMPORT_FORMAT && value.format !== LEGACY_MAP_IMPORT_FORMAT) ||
      (value.version !== IMPORT_VERSION && value.version !== TEACHING_IMPORT_VERSION) ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      typeof value.startTopic !== 'string' || !value.startTopic.trim() ||
      !Array.isArray(value.topics) || !value.topics.length || value.topics.length > MAX_TOPICS ||
      !Array.isArray(value.connections)) {
    throw new Error('This is not a supported Map-mode Guide import.');
  }

  if (value.version !== TEACHING_IMPORT_VERSION && value.solvers !== undefined)
    throw new Error('Algorithm solvers are supported only in version 2 Teaching Block maps.');
  const backgrounds: readonly GuideMapPattern[] = ['water','contours','constellations','flow','fireflies','circuit','programming','power-lines','plain'];
  if (value.background !== undefined && !backgrounds.includes(value.background as GuideMapPattern))
    throw new Error('Map background must be Water, Contours, Constellations, Flow, Fireflies, Circuit Board, Programming, Power Lines or Plain.');
  const background = value.background as GuideMapPattern | undefined;
  const solvers = parseAiSolvers(value.solvers);
  if (value.topics.length > GUIDE_AI_MAX_SPACED_TOPICS && value.version === TEACHING_IMPORT_VERSION)
    throw new Error('For separated map stops, generate at most ' + GUIDE_AI_MAX_SPACED_TOPICS + ' topics.');
  const keys = new Set<string>();
  const topics = value.topics.map((topic, topicIndex): SimpleMapGuideImportTopic => {
    if (!isRecord(topic) ||
        Object.keys(topic).some((key) => !['key', 'title', 'description', 'position', 'sections', 'lesson'].includes(key)) ||
        typeof topic.key !== 'string' || !topic.key.trim() || topic.key.trim().length > MAX_TEXT_LENGTH ||
        typeof topic.title !== 'string' || !topic.title.trim() || topic.title.trim().length > MAX_TEXT_LENGTH ||
        (Object.hasOwn(topic, 'description') && (typeof topic.description !== 'string' || topic.description.length > MAX_TEXT_LENGTH)) ||
        (Object.hasOwn(topic, 'position') && (
          !Array.isArray(topic.position) || topic.position.length !== 2 ||
          !topic.position.every(value => typeof value === 'number' && Number.isInteger(value)) ||
          topic.position[0] < 0 || topic.position[0] > MAP_MAX_X || topic.position[0] % MAP_GRID !== 0 ||
          topic.position[1] < 0 || topic.position[1] > MAP_MAX_Y || topic.position[1] % MAP_GRID !== 0
        ))) {
      throw new Error(`Topic ${topicIndex + 1} is empty, too long, or has an invalid map position.`);
    }
    const key = topic.key.trim();
    if (keys.has(key)) throw new Error(`Topic key "${key}" is duplicated.`);
    keys.add(key);
    if (topic.lesson === undefined && topic.sections === undefined)
      throw new Error('Topic ' + (topicIndex + 1) + ' needs Teaching Blocks or sections.');
    if (value.version === TEACHING_IMPORT_VERSION && topic.lesson === undefined)
      throw new Error('Topic ' + (topicIndex + 1) + ' is missing its Teaching Blocks lesson.');
    const position = Array.isArray(topic.position)
      ? [topic.position[0] as number, topic.position[1] as number] as const
      : undefined;
    return {
      key,
      title: topic.title.trim(),
      ...(typeof topic.description === 'string' && topic.description.trim() ? { description: topic.description.trim() } : {}),
      position,
      sections: topic.sections === undefined ? [] : parseImportSections(topic.sections, { count: 0 }, `Topic ${topicIndex + 1}`),
      ...(topic.lesson === undefined ? {} : { lesson: parseAiTeachingLesson(topic.lesson, solvers) }),
    };
  });

  for (const pkg of solvers) {
    const used = topics.some(topic => topic.lesson?.blocks.some(block =>
      block.kind === 'parameterized' && block.rules.solver?.package?.id === pkg.id &&
      block.rules.solver.package.solverVersion === pkg.solverVersion));
    if (!used) throw new Error('Algorithm solver “' + pkg.label + '” is not referenced by any Teaching Block.');
  }
  const positionedTopics = topics.filter(topic => topic.position !== undefined);
  if (positionedTopics.length !== 0 && positionedTopics.length !== topics.length) {
    throw new Error('Map-mode AI positions must be provided for every topic or omitted for every topic.');
  }
  // Discard cramped AI suggestions and let the import layout engine repair them.
  const allSpaced = positionedTopics.length === topics.length &&
    stopsAreSpaced(positionedTopics.map(topic => ({ x: topic.position![0], y: topic.position![1] })));
  if (!allSpaced) topics.forEach(topic => { topic.position = undefined; });

  const startTopic = value.startTopic.trim();
  if (!keys.has(startTopic)) throw new Error('The starting topic does not match a topic key.');

  const pairs = new Set<string>();
  const adjacency = new Map([...keys].map(key => [key, new Set<string>()]));
  const connections = value.connections.map((connection, index): { from: string; to: string } => {
    if (!Array.isArray(connection) || connection.length !== 2 ||
        typeof connection[0] !== 'string' || typeof connection[1] !== 'string') {
      throw new Error(`Connection ${index + 1} must be [fromTopicKey, toTopicKey].`);
    }
    const from = connection[0].trim();
    const to = connection[1].trim();
    if (!from || !to || !keys.has(from) || !keys.has(to)) {
      throw new Error(`Connection ${index + 1} references an unknown topic.`);
    }
    if (from === to) throw new Error(`Connection ${index + 1} connects a topic to itself.`);
    const pair = [from, to].sort().join('\u0000');
    if (pairs.has(pair)) throw new Error(`Connection ${index + 1} duplicates an existing path.`);
    pairs.add(pair);
    adjacency.get(from)?.add(to);
    adjacency.get(to)?.add(from);
    return { from, to };
  });

  if (connections.length !== topics.length - 1) {
    throw new Error(`A connected Map-mode Guide with ${topics.length} topics needs exactly ${Math.max(0, topics.length - 1)} paths.`);
  }

  const reached = new Set<string>([startTopic]);
  const pending = [startTopic];
  while (pending.length) {
    const current = pending.shift();
    if (!current) break;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (reached.has(neighbor)) continue;
      reached.add(neighbor);
      pending.push(neighbor);
    }
  }
  if (reached.size !== topics.length) {
    throw new Error('Every Map-mode topic must be connected to the starting topic.');
  }

  return { mode: 'map', title: value.title.trim(), startTopic, topics, connections,
    ...(background ? { background } : {}),
    confidence: parseGuideConfidence(value.confidence),
    coverage: value.coverage === undefined ? undefined : parseAiSubjectCoverage(value.coverage, topics.length) };
}

export function parseGuideAiImport(text: string, mode: GuideMode = 'list'): SimpleGuideImport {
  const value = parsedJson(text);
  return mode === 'map' ? parseMapImport(value) : parseListImport(value);
}

function importBulletCount(value: SimpleListGuideImport): number {
  return value.sections.reduce((count, section) => count + section.bullets.length, 0);
}

function mapBulletCount(value: SimpleMapGuideImport): number {
  return value.topics.reduce((total, topic) =>
    total + topic.sections.reduce((count, section) => count + section.bullets.length, 0), 0);
}

export const GuideAiImportWorkspace = defineComponent({
  name: 'GuideAiImportWorkspace',
  props: {
    destination: { type: String, required: true },
    mode: { type: String as PropType<GuideMode>, required: true },
    direct: Boolean,
  },
  emits: { back: () => true, cancel: () => true, import: (_value: SimpleGuideImport) => true },
  setup(props, { emit }) {
    const stage = ref<'scope' | 'categories' | 'exchange' | 'review'>(props.direct ? 'exchange' : 'scope');
    const candidate = ref<SimpleGuideImport | null>(null);
    const returningFromReview = ref(false);
    const chosenScope = ref<AiCardScope | null>(null);
    const categoryList = ref<AiCardCategories | null>(null);
    const exchangeRef = ref<AiPromptExchangeHandle | null>(null);
    function back() {
      if (stage.value === 'review') { returningFromReview.value = true; stage.value = 'exchange'; }
      else if (stage.value === 'exchange') {
        if (exchangeRef.value?.goBack()) return;
        if (props.direct) { emit('back'); return; }
        stage.value = chosenScope.value ? 'categories' : 'scope';
      } else if (stage.value === 'categories') stage.value = 'scope';
      else emit('back');
    }
    const detail = ref<PromptDetail>(DEFAULT_PROMPT_OPTIONS.detail);
    const coverage = ref<PromptCoverage>(DEFAULT_PROMPT_OPTIONS.coverage);
    const bulletStyle = ref<PromptBulletStyle>(DEFAULT_PROMPT_OPTIONS.bulletStyle);
    const mixMode = ref<TeachingMixMode>('ai');
    const aiFocus = ref<GuideAiFocus>('default');
    const targetBlocks = ref(30);
    const weights = ref<TeachingWeights>({ ...DEFAULT_TEACHING_WEIGHTS });
    const mixError = computed(() => props.mode === 'map' ? teachingMixProblem(mixMode.value, weights.value, targetBlocks.value) : '');
    const allocations = computed(() => mixError.value || mixMode.value !== 'custom' ? null : allocateTeachingBlocks(weights.value, targetBlocks.value));
    const json = ref('');
    const problem = ref('');
    const prompt = computed(() => mixError.value ? '' : guideAiPrompt({
      detail: detail.value, coverage: coverage.value, bulletStyle: bulletStyle.value,
      mixMode: mixMode.value, aiFocus: aiFocus.value,
      targetBlocks: targetBlocks.value, weights: weights.value,
    }, props.mode, chosenScope.value));
    function importValidated() {
      problem.value = '';
      try {
        let imported: SimpleGuideImport;
        if (props.direct) {
          try { imported = parseGuideAiImport(json.value, 'list'); }
          catch { imported = parseGuideAiImport(json.value, 'map'); }
        } else imported = parseGuideAiImport(json.value, props.mode);
        if (!props.direct && !imported.coverage)
          throw new Error('The response is missing its source coverage inventory. Request corrected JSON.');
        if (!props.direct && !imported.confidence)
          throw new Error('The response is missing its AI confidence estimates. Request corrected JSON with confidence.');
        candidate.value = imported;
        returningFromReview.value = false;
        stage.value = 'review';
      } catch (error) {
        problem.value = error instanceof Error ? error.message : String(error);
      }
    }
    function optionField<T extends string>(
      id: string,
      label: string,
      value: T,
      options: readonly { value: T; label: string }[],
      change: (value: T) => void,
      explanation: string,
    ) {
      return h('label', { for: id, class: 'guide-ai-option' }, [
        h('span', label),
        h('select', {
          id,
          value,
          onChange: (event: Event) => {
            if (event.target instanceof HTMLSelectElement) change(event.target.value as T);
          },
        }, options.map((option) => h('option', { value: option.value }, option.label))),
        h('small', { class: 'study-ai-muted' }, explanation),
      ]);
    }

    return () => stage.value === 'categories' ? h(AiCategoryPicker, {
      key: 'guide-categories', label: 'Guide', destination: props.destination,
      initialCategories: categoryList.value, onBack: () => { stage.value = 'scope'; },
      onCancel: () => emit('cancel'),
      onSelect: (selected: AiCardScope, list: AiCardCategories) => {
        chosenScope.value = selected; categoryList.value = list; stage.value = 'exchange';
      },
    }) : stage.value === 'review' && candidate.value ? h(GuideAiReview, {
      candidate: candidate.value, direct: props.direct,
      targetBlocks: !props.direct && props.mode === 'map' ? targetBlocks.value : 0,
      onBack: back, onCancel: () => emit('cancel'),
      onCreate: () => { if (candidate.value) emit('import', candidate.value); },
    }) : h('section', { class: 'guide-ai-workspace', 'aria-labelledby': 'guide-ai-title' }, [
      h('header', { class: 'guide-ai-header' }, [
        h('div', { class: 'guide-ai-heading' }, [
          h('span', { class: 'guide-ai-kicker' }, `${props.direct ? 'Existing AI response' : props.mode === 'map' ? 'Map mode' : 'List mode'} · Saved in ${props.destination}`),
          h('h2', { id: 'guide-ai-title' }, stage.value === 'scope' ? 'Choose what to teach' : chosenScope.value?.category.title ?? 'Create with AI'),
          h('p', props.direct ? 'Import an existing AI response.' : stage.value === 'scope' ? 'Choose between the overall subject and a specific category, just like Review.' : chosenScope.value?.category.description ?? 'Prepare a Guide from your source material with AI.'),
        ]),
        h('div', { class: 'guide-ai-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: back }, 'Back'),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        ]),
      ]),
      stage.value === 'scope' ? h(AiScopeChoices, {
        onOverall: () => { chosenScope.value = null; stage.value = 'exchange'; },
        onCategory: () => { stage.value = 'categories'; },
      }) : h(AiPromptExchange, {
        ref: exchangeRef, idPrefix: 'guide-ai', label: 'Guide', prompt: prompt.value, json: json.value, problem: problem.value, startInImport: props.direct || returningFromReview.value, importOnly: props.direct,
        hasPreview: false, showReviewStep: !props.direct,
        skipSource: Boolean(chosenScope.value),
        preferFileImport: true, maxLength: MAX_AI_IMPORT_LENGTH,
        promptHelp: 'Create a guided interactive lesson from your source, using Teaching Blocks and an exploratory map.',
        importHelp: 'Upload your AI-generated JSON file or paste the response, then preview the content and coverage estimates.',
        validateLabel: 'Check & preview',
        onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; },
        onValidate: importValidated,
      }, {
        options: () => h('div', { class: 'guide-ai-options' }, [
              optionField('guide-ai-detail', 'Detail', detail.value, [
                { value: 'concise', label: 'Concise' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'detailed', label: 'Detailed' },
              ], (value) => { detail.value = value; }, 'How much information appears within each section.'),
              optionField('guide-ai-coverage', 'Coverage', coverage.value, [
                { value: 'essentials', label: 'Essentials only' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'comprehensive', label: 'Comprehensive' },
              ], (value) => { coverage.value = value; }, 'Key ideas only or more of the subject.'),
              props.mode === 'list' ? optionField('guide-ai-bullet-style', 'Bullet style', bulletStyle.value, [
                { value: 'phrases', label: 'Key phrases' },
                { value: 'thoughts', label: 'Complete thoughts' },
              ], (value) => { bulletStyle.value = value; }, 'List mode retains the classic notes format.') : null,
              props.mode === 'map' ? h('div', { class: 'guide-ai-teaching-settings' }, [
                h('h3', 'Teaching Blocks mix'),
                h('p', { class: 'study-ai-muted' },
                  'Like Review, let AI choose the best types or specify your own weighted distribution. Teaching Blocks help explain concepts before Review assesses them.'),
                h('div', { class: 'guide-ai-mix-modes', role: 'group', 'aria-label': 'Teaching block selection strategy' }, [
                  ...([['ai', 'Let AI choose'], ['custom', 'Custom weighted mix']] as const).map(([value, label]) =>
                    h('button', { type: 'button', class: 'quiet-button', key: value,
                      'aria-pressed': mixMode.value === value, onClick: () => { mixMode.value = value; } }, label)),
                ]),
                mixMode.value === 'ai' ? h(AiFocusChoices, {
                  options: GUIDE_AI_FOCUSES,
                  value: aiFocus.value,
                  name: 'guide-ai-focus',
                  onSelect: (id: string) => { aiFocus.value = id as GuideAiFocus; },
                }) : null,
                h('label', { class: 'guide-ai-option' }, [
                  h('span', 'Target total Teaching Blocks'),
                  h('input', { type: 'number', min: 1, max: 80, step: 1, value: targetBlocks.value,
                    onInput: (event: Event) => { targetBlocks.value = Number(inputValue(event)); } }),
                  h('small', 'AI aims for this exact total across 5–7 stops unless the source warrants an exception. No filler.'),
                ]),
                mixMode.value === 'custom' ? h('div', { class: 'guide-ai-weight-list' },
                  TEACHING_TYPES.map(kind => h('label', { class: 'guide-ai-weight-row', key: kind }, [
                    h('span', kind.replace(/-/g, ' ')),
                    h('input', { type: 'number', min: 0, max: 100, step: 1,
                      'aria-label': kind + ' teaching block percentage', value: weights.value[kind],
                      onChange: (event: Event) => {
                        weights.value = rebalanceTeachingWeights(weights.value, kind, Number(inputValue(event)));
                      } }),
                    h('span', '%'),
                    allocations.value ? h('small', '≈ ' + allocations.value[kind]) : null,
                  ]))) : null,
                mixError.value ? h('p', { class: 'guide-ai-mix-error', role: 'alert' }, mixError.value) : null,
              ]) : null,
            ]),

      }),
    ]);
  },
});
