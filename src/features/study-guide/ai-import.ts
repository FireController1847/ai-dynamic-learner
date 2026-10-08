import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { inputValue } from '../../core/dom.ts';
import { isRecord } from '../../core/validation.ts';
import {
  MAP_GRID, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH,
  MAX_BULLETS, MAX_NAME_LENGTH, MAX_SECTIONS, MAX_TEXT_LENGTH, MAX_TOPICS, type StudyGuideMode,
} from './library-model.ts';

const LIST_IMPORT_FORMAT = 'dynamic-learner-study-guide';
const MAP_IMPORT_FORMAT = 'dynamic-learner-study-guide-map';
const IMPORT_VERSION = 1;
const MAX_IMPORT_BULLET_DEPTH = 7;
const JSON_FENCE = '```';

type PromptDetail = 'concise' | 'balanced' | 'detailed';
type PromptCoverage = 'essentials' | 'balanced' | 'comprehensive';
type PromptBulletStyle = 'phrases' | 'thoughts';

export interface StudyGuideAiPromptOptions {
  detail: PromptDetail;
  coverage: PromptCoverage;
  bulletStyle: PromptBulletStyle;
}

export interface SimpleStudyGuideImportSection {
  title: string;
  bullets: string[];
}

export interface SimpleListStudyGuideImport {
  mode: 'list';
  title: string;
  sections: SimpleStudyGuideImportSection[];
}

export interface SimpleMapStudyGuideImportTopic {
  key: string;
  title: string;
  position?: readonly [number, number];
  sections: SimpleStudyGuideImportSection[];
}

export interface SimpleMapStudyGuideImport {
  mode: 'map';
  title: string;
  startTopic: string;
  topics: SimpleMapStudyGuideImportTopic[];
  connections: { from: string; to: string }[];
}

export type SimpleStudyGuideImport = SimpleListStudyGuideImport | SimpleMapStudyGuideImport;

const DEFAULT_PROMPT_OPTIONS: StudyGuideAiPromptOptions = {
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

function promptIntro(options: StudyGuideAiPromptOptions, mode: StudyGuideMode): string {
  const planning = mode === 'list'
    ? 'Silently organize the source into a logical outline, then classify possible study points as high, moderate, or low priority. Use that planning only to decide the final sections, bullets, and sub-bullets; do not output the planning itself.'
    : 'Silently organize the source into a logical topic structure, then classify possible study points as high, moderate, or low priority. Use that planning only to decide the final topics, paths, sections, and bullets; do not output the planning itself.';
  return `Using the source material I supplied immediately before this instruction, create a Dynamic Learner Study Guide.

Write in the style of a capable student taking organized notes during class: compact, practical, and easy to scan. This is a study guide, not a rewritten textbook or transcript.

${planning}

Selected preferences:
- Detail: ${DETAIL_INSTRUCTIONS[options.detail]}
- Coverage: ${COVERAGE_INSTRUCTIONS[options.coverage]}
- Bullet style: ${BULLET_STYLE_INSTRUCTIONS[options.bulletStyle]}

Condense freely when several facts can be represented by one useful note. Prefer losing low-value detail over making the guide long.

Do NOT include citations, references, footnotes, source annotations, source lists, or citation/source URLs anywhere in the response. Do not emit ChatGPT citation markers or content-reference tokens such as :chatgpt-content-reference{...}, :contentReference[...]{...}, or cite.... Omit citations even if the source material contains them. The JSON must contain study content only.`;
}

function listPrompt(options: StudyGuideAiPromptOptions): string {
  return `${promptIntro(options, 'list')}

Return ONLY one fenced JSON code block, starting with ${JSON_FENCE}json and ending with ${JSON_FENCE}.

Use this structure:
${JSON_FENCE}json
{
  "format": "${LIST_IMPORT_FORMAT}",
  "version": ${IMPORT_VERSION},
  "title": "Short study guide title",
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

function mapPrompt(options: StudyGuideAiPromptOptions): string {
  return `${promptIntro(options, 'map')}

Create a connected topic map that feels like an adventurous path the learner can explore, not a plain outline drawn as boxes. Each topic is a study stop with its own small list-style guide. Put the topics in a useful learning order so one stop naturally leads to the next.

Shape the route like a small exploration tree:
- build a clear main path through most of the material;
- for a medium or large map, usually add one or two meaningful branch points when the content supports them instead of forcing everything into one straight chain;
- keep side branches short, usually one or two stops and only occasionally three, so the learner can explore them and naturally backtrack to the main route;
- a branch may go above or below the main path and should feel like a short optional trail;
- avoid both extremes: do not make every topic a single unbranched line, and do not make a hub-and-spoke map where one broad topic connects to most other topics;
- most topics should have one or two connections; three is appropriate at a genuine fork;
- connect concepts according to prerequisite, chronology, process, increasing depth, or another natural learning progression.

Make the visual layout creative and predominantly horizontal, like an adventure-map trail:
- place the starting topic toward the left and let the main route generally progress toward the right;
- let the route gently wander up and down instead of putting every stop on one row;
- place short branches above or below the main route;
- do not form a vertical line or a vertical tree;
- avoid overlapping topic boxes and leave breathing room between nearby stops;
- every topic must include a suggested "position": [x, y]. x and y are snapped map coordinates, not semantic data.

The map must still be one connected tree: every topic is reachable from the starting topic, there are no loops/cycles, no duplicate connections, and a topic is never connected to itself. With N topics, use exactly N-1 connections.

Return ONLY one fenced JSON code block, starting with ${JSON_FENCE}json and ending with ${JSON_FENCE}.

Use this structure:
${JSON_FENCE}json
{
  "format": "${MAP_IMPORT_FORMAT}",
  "version": ${IMPORT_VERSION},
  "title": "Short study guide title",
  "startTopic": "foundations",
  "topics": [
    {
      "key": "foundations",
      "title": "Foundations",
      "position": [64, 384],
      "sections": [
        {
          "title": "Core ideas",
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
    },
    {
      "key": "core-process",
      "title": "Core Process",
      "position": [288, 288],
      "sections": [
        {
          "title": "How it works",
          "bullets": [
            { "text": "Core process point" }
          ]
        }
      ]
    },
    {
      "key": "applications",
      "title": "Applications",
      "position": [608, 352],
      "sections": [
        {
          "title": "Using the ideas",
          "bullets": [
            { "text": "Application point" }
          ]
        }
      ]
    },
    {
      "key": "case-study",
      "title": "Case Study",
      "position": [608, 544],
      "sections": [
        {
          "title": "Explore a side trail",
          "bullets": [
            { "text": "Short branch point" }
          ]
        }
      ]
    },
    {
      "key": "advanced-topics",
      "title": "Advanced Topics",
      "position": [960, 288],
      "sections": [
        {
          "title": "Going deeper",
          "bullets": [
            { "text": "Advanced point" }
          ]
        }
      ]
    }
  ],
  "connections": [
    ["foundations", "core-process"],
    ["core-process", "applications"],
    ["applications", "advanced-topics"],
    ["applications", "case-study"]
  ]
}
${JSON_FENCE}

Map rules:
- "key" is a short unique local reference used only by this JSON response;
- "startTopic" must match one topic key;
- each connection is exactly [fromTopicKey, toTopicKey];
- order connections to reflect the intended exploration route from the starting topic outward;
- make the longest useful learning path pass through most of the material, while allowing one or two short side trails when useful;
- prefer a horizontal main route with occasional small forks; avoid both a perfectly straight chain and a wide hub-and-spoke structure;
- "position" is [x, y] on Dynamic Learner's 1440×896 map canvas;
- position x must be a multiple of ${MAP_GRID} from 0–${MAP_MAX_X}; position y must be a multiple of ${MAP_GRID} from 0–${MAP_MAX_Y};
- each topic occupies about ${MAP_TOPIC_WIDTH}×${MAP_TOPIC_HEIGHT}; keep topic rectangles from overlapping;
- use position creatively to make the route visually wander while still reading primarily left-to-right;
- every topic should represent a meaningful conceptual stop, not a single trivia fact;
- each topic's sections and nested bullets use the same note structure as List mode;
- preserve important terminology and factual accuracy;
- do not invent unsupported information.

Limits:
- title: 1–${MAX_NAME_LENGTH} characters;
- 1–${MAX_TOPICS} topics;
- each topic supports up to ${MAX_SECTIONS} sections and ${MAX_BULLETS} bullets/sub-bullets;
- topic titles, section titles, bullet text, and topic keys must be non-empty plain text no longer than ${MAX_TEXT_LENGTH} characters;
- at most ${MAX_IMPORT_BULLET_DEPTH + 1} bullet levels;
- do not generate Dynamic Learner IDs, groups, or other application fields. Dynamic Learner validates suggested positions and owns the stored map data.`;
}

export function studyGuideAiPrompt(
  options: StudyGuideAiPromptOptions = DEFAULT_PROMPT_OPTIONS,
  mode: StudyGuideMode = 'list',
): string {
  return mode === 'map' ? mapPrompt(options) : listPrompt(options);
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
    throw new Error(`A Study Guide section set can contain up to ${MAX_BULLETS} bullets and sub-bullets.`);
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
): SimpleStudyGuideImportSection[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_SECTIONS) {
    throw new Error(`${label} must contain 1–${MAX_SECTIONS} sections.`);
  }
  return value.map((section, sectionIndex): SimpleStudyGuideImportSection => {
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
    throw new Error('The pasted content is not valid JSON.');
  }
}

function parseListImport(value: unknown): SimpleListStudyGuideImport {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'sections'].includes(key)) ||
      value.format !== LIST_IMPORT_FORMAT || value.version !== IMPORT_VERSION ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH) {
    throw new Error('This is not a supported List-mode Study Guide import.');
  }
  const state = { count: 0 };
  return {
    mode: 'list',
    title: value.title.trim(),
    sections: parseImportSections(value.sections, state, 'Study Guide'),
  };
}

function parseMapImport(value: unknown): SimpleMapStudyGuideImport {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'startTopic', 'topics', 'connections'].includes(key)) ||
      value.format !== MAP_IMPORT_FORMAT || value.version !== IMPORT_VERSION ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      typeof value.startTopic !== 'string' || !value.startTopic.trim() ||
      !Array.isArray(value.topics) || !value.topics.length || value.topics.length > MAX_TOPICS ||
      !Array.isArray(value.connections)) {
    throw new Error('This is not a supported Map-mode Study Guide import.');
  }

  const keys = new Set<string>();
  const topics = value.topics.map((topic, topicIndex): SimpleMapStudyGuideImportTopic => {
    if (!isRecord(topic) ||
        Object.keys(topic).some((key) => !['key', 'title', 'sections'].includes(key)) ||
        typeof topic.key !== 'string' || !topic.key.trim() || topic.key.trim().length > MAX_TEXT_LENGTH ||
        typeof topic.title !== 'string' || !topic.title.trim() || topic.title.trim().length > MAX_TEXT_LENGTH) {
      throw new Error(`Topic ${topicIndex + 1} is empty, too long, or invalid.`);
    }
    const key = topic.key.trim();
    if (keys.has(key)) throw new Error(`Topic key "${key}" is duplicated.`);
    keys.add(key);
    return {
      key,
      title: topic.title.trim(),
      sections: parseImportSections(topic.sections, { count: 0 }, `Topic ${topicIndex + 1}`),
    };
  });

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
    throw new Error(`A connected Map-mode Study Guide with ${topics.length} topics needs exactly ${Math.max(0, topics.length - 1)} paths.`);
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

  return { mode: 'map', title: value.title.trim(), startTopic, topics, connections };
}

export function parseStudyGuideAiImport(text: string, mode: StudyGuideMode = 'list'): SimpleStudyGuideImport {
  const value = parsedJson(text);
  return mode === 'map' ? parseMapImport(value) : parseListImport(value);
}

function importBulletCount(value: SimpleListStudyGuideImport): number {
  return value.sections.reduce((count, section) => count + section.bullets.length, 0);
}

function mapBulletCount(value: SimpleMapStudyGuideImport): number {
  return value.topics.reduce((total, topic) =>
    total + topic.sections.reduce((count, section) => count + section.bullets.length, 0), 0);
}

export const StudyGuideAiImportWorkspace = defineComponent({
  name: 'StudyGuideAiImportWorkspace',
  props: {
    destination: { type: String, required: true },
    mode: { type: String as PropType<StudyGuideMode>, required: true },
  },
  emits: {
    back: () => true,
    cancel: () => true,
    import: (_value: SimpleStudyGuideImport) => true,
  },
  setup(props, { emit }) {
    const tab = ref<'prompt' | 'import'>('prompt');
    const detail = ref<PromptDetail>(DEFAULT_PROMPT_OPTIONS.detail);
    const coverage = ref<PromptCoverage>(DEFAULT_PROMPT_OPTIONS.coverage);
    const bulletStyle = ref<PromptBulletStyle>(DEFAULT_PROMPT_OPTIONS.bulletStyle);
    const showPrompt = ref(false);
    const json = ref('');
    const problem = ref('');
    const copyStatus = ref('');
    const copyAnimating = ref(false);
    const handoff = ref<'idle' | 'waiting' | 'ready'>('idle');
    const jsonInput = ref<HTMLTextAreaElement | null>(null);
    const candidate = ref<SimpleStudyGuideImport | null>(null);
    let copyTimer: number | null = null;
    const prompt = computed(() => studyGuideAiPrompt({
      detail: detail.value,
      coverage: coverage.value,
      bulletStyle: bulletStyle.value,
    }, props.mode));

    function clearCopyTimer() {
      if (copyTimer !== null) window.clearTimeout(copyTimer);
      copyTimer = null;
    }

    onBeforeUnmount(clearCopyTimer);

    async function copyPrompt() {
      clearCopyTimer();
      try {
        await navigator.clipboard.writeText(prompt.value);
        copyStatus.value = 'Prompt copied.';
        copyAnimating.value = true;
        handoff.value = 'waiting';
        copyTimer = window.setTimeout(() => {
          copyTimer = null;
          copyAnimating.value = false;
          copyStatus.value = '';
          tab.value = 'import';
          problem.value = '';
        }, 650);
      } catch {
        copyAnimating.value = false;
        handoff.value = 'idle';
        showPrompt.value = true;
        copyStatus.value = 'Copy failed. The prompt is shown below so you can copy it manually.';
      }
    }

    async function responseReady() {
      handoff.value = 'ready';
      await nextTick();
      jsonInput.value?.focus();
    }

    function preview() {
      problem.value = '';
      candidate.value = null;
      try {
        candidate.value = parseStudyGuideAiImport(json.value, props.mode);
      } catch (error) {
        problem.value = error instanceof Error ? error.message : String(error);
      }
    }

    function selectTab(next: 'prompt' | 'import') {
      tab.value = next;
      problem.value = '';
    }

    const tabButton = (id: 'prompt' | 'import', label: string) => h('button', {
      type: 'button',
      class: 'quiet-button',
      role: 'tab',
      'aria-selected': tab.value === id,
      onClick: () => selectTab(id),
    }, label);

    function optionField<T extends string>(
      id: string,
      label: string,
      value: T,
      options: readonly { value: T; label: string }[],
      change: (value: T) => void,
    ) {
      return h('label', { for: id, class: 'study-guide-ai-option' }, [
        h('span', label),
        h('select', {
          id,
          value,
          onChange: (event: Event) => {
            if (event.target instanceof HTMLSelectElement) change(event.target.value as T);
            copyStatus.value = '';
          },
        }, options.map((option) => h('option', { value: option.value }, option.label))),
      ]);
    }

    function importPreview(value: SimpleStudyGuideImport) {
      if (value.mode === 'list') {
        return [
          h('strong', value.title),
          h('span', { class: 'study-guide-ai-status' },
            `${value.sections.length} section${value.sections.length === 1 ? '' : 's'} · ${importBulletCount(value)} bullets and sub-bullets`),
          h('ul', [
            ...value.sections.slice(0, 5).map((section) =>
              h('li', `${section.title} — ${section.bullets.length} item${section.bullets.length === 1 ? '' : 's'}`)),
            value.sections.length > 5 ? h('li', `…and ${value.sections.length - 5} more sections`) : null,
          ]),
        ];
      }

      const start = value.topics.find(topic => topic.key === value.startTopic);
      return [
        h('strong', value.title),
        h('span', { class: 'study-guide-ai-status' },
          `${value.topics.length} topic${value.topics.length === 1 ? '' : 's'} · ${value.connections.length} path${value.connections.length === 1 ? '' : 's'} · ${mapBulletCount(value)} bullets and sub-bullets`),
        h('span', { class: 'study-guide-ai-status' }, 'Starts at ' + (start?.title ?? value.startTopic)),
        h('ul', [
          ...value.topics.slice(0, 5).map(topic =>
            h('li', `${topic.title} — ${topic.sections.length} section${topic.sections.length === 1 ? '' : 's'}`)),
          value.topics.length > 5 ? h('li', `…and ${value.topics.length - 5} more topics`) : null,
        ]),
      ];
    }

    const modeLabel = computed(() => props.mode === 'map' ? 'Map mode' : 'List mode');
    const placeholder = computed(() => props.mode === 'map'
      ? '{\n  "format": "dynamic-learner-study-guide-map",\n  "topics": [\n    ...\n  ],\n  "connections": [\n    ...\n  ]\n}'
      : '{\n  "format": "dynamic-learner-study-guide",\n  "sections": [\n    ...\n  ]\n}');

    return () => h('section', {
      class: 'study-guide-ai-workspace',
      'aria-labelledby': 'study-guide-ai-title',
    }, [
      h('header', { class: 'study-guide-ai-header' }, [
        h('div', { class: 'study-guide-ai-heading' }, [
          h('span', { class: 'study-guide-ai-kicker' }, modeLabel.value + ' · Saved in ' + props.destination),
          h('h2', { id: 'study-guide-ai-title' }, 'Create with AI'),
          h('p', 'Generate a prompt for your AI, then paste its JSON response back here to create the guide.'),
        ]),
        h('div', { class: 'study-guide-ai-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        ]),
      ]),
      h('div', { class: 'study-guide-ai-content' }, [
        h('div', { role: 'tablist', 'aria-label': 'Study Guide import method', class: 'study-guide-ai-tabs' }, [
          tabButton('prompt', 'AI Prompt'),
          tabButton('import', 'JSON Import'),
        ]),
        tab.value === 'prompt'
          ? h('section', { role: 'tabpanel', class: 'study-guide-ai-panel' }, [
            h('p', { class: 'study-guide-ai-help' },
              props.mode === 'map'
                ? 'Give the AI the source material first. The prompt asks it for topic relationships and study content; Dynamic Learner assigns IDs and lays the map out after import.'
                : 'Give the AI the source material first. Then paste this generated prompt after it. Paste the returned JSON into the JSON Import tab.'),
            h('div', { class: 'study-guide-ai-options' }, [
              optionField('study-guide-ai-detail', 'Detail', detail.value, [
                { value: 'concise', label: 'Concise' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'detailed', label: 'Detailed' },
              ], (value) => { detail.value = value; }),
              optionField('study-guide-ai-coverage', 'Coverage', coverage.value, [
                { value: 'essentials', label: 'Essentials only' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'comprehensive', label: 'Comprehensive' },
              ], (value) => { coverage.value = value; }),
              optionField('study-guide-ai-bullet-style', 'Bullet style', bulletStyle.value, [
                { value: 'phrases', label: 'Key phrases' },
                { value: 'thoughts', label: 'Complete thoughts' },
              ], (value) => { bulletStyle.value = value; }),
            ]),
            h('div', { class: 'study-guide-ai-copy-row' }, [
              h('div', { class: 'study-guide-ai-copy-actions' }, [
                h('button', {
                  type: 'button',
                  class: ['card-primary-button study-guide-ai-copy-button', { 'is-copied': copyAnimating.value }],
                  onClick: copyPrompt,
                }, copyAnimating.value ? '✓ Copied!' : 'Copy prompt'),
                h('button', {
                  type: 'button',
                  class: 'quiet-button study-guide-ai-prompt-toggle',
                  title: showPrompt.value ? 'Hide prompt' : 'Show prompt',
                  'aria-label': showPrompt.value ? 'Hide generated prompt' : 'Show generated prompt',
                  'aria-expanded': showPrompt.value,
                  'aria-controls': 'study-guide-ai-prompt-preview',
                  onClick: () => { showPrompt.value = !showPrompt.value; },
                }, [h(Icon, { name: showPrompt.value ? 'chevron-up' : 'chevron-down' })]),
              ]),
              copyStatus.value ? h('span', { role: 'status', class: 'study-guide-ai-status' }, copyStatus.value) : null,
            ]),
            showPrompt.value ? h('textarea', {
              id: 'study-guide-ai-prompt-preview',
              value: prompt.value,
              readonly: true,
              rows: 17,
              'aria-label': 'AI Study Guide prompt',
              class: 'study-guide-ai-prompt-preview',
            }) : null,
          ])
          : h('section', { role: 'tabpanel', class: 'study-guide-ai-panel' }, [
            handoff.value === 'waiting'
              ? h('div', { class: 'study-guide-ai-handoff', role: 'status' }, [
                h('strong', 'Prompt copied — send it to your AI.'),
                h('p', 'Paste the copied prompt after your source material. Wait for the AI to finish generating its JSON response, then come back here.'),
                h('button', {
                  type: 'button',
                  class: 'card-primary-button',
                  onClick: responseReady,
                }, 'My AI response is ready'),
              ])
              : null,
            handoff.value === 'ready'
              ? h('div', { class: 'study-guide-ai-handoff is-ready' }, [
                h('strong', 'Great — bring the JSON back here.'),
                h('ol', [
                  h('li', 'Paste the AI response into the box below.'),
                  h('li', 'Choose Validate JSON.'),
                  h('li', 'Review the preview, then choose Import study guide.'),
                ]),
              ])
              : h('p', { class: 'study-guide-ai-help' },
                props.mode === 'map'
                  ? 'Paste the JSON code block returned by the AI. Dynamic Learner validates every topic and path before creating anything, then assigns IDs and map positions.'
                  : 'Paste the JSON code block returned by the AI. Dynamic Learner removes the code fence if present and validates the JSON before creating anything.'),
            handoff.value !== 'waiting' ? [
              h('textarea', {
                ref: jsonInput,
                value: json.value,
                rows: 12,
                placeholder: placeholder.value,
                'aria-label': 'Study Guide JSON import',
                class: 'study-guide-ai-json',
                onInput: (event: Event) => {
                  json.value = inputValue(event);
                  candidate.value = null;
                  problem.value = '';
                },
              }),
              h('div', { class: 'study-guide-ai-validate-row' }, [
                h('button', { type: 'button', class: 'quiet-button', disabled: !json.value.trim(), onClick: preview }, 'Validate JSON'),
                problem.value ? h('span', { role: 'alert', class: 'study-guide-ai-error' }, problem.value) : null,
              ]),
              h('div', { class: 'study-guide-ai-preview-slot' }, [
                candidate.value ? h('div', { class: 'study-guide-ai-preview' }, [
                  ...importPreview(candidate.value),
                  h('button', {
                    type: 'button',
                    class: 'card-primary-button',
                    onClick: () => { if (candidate.value) emit('import', candidate.value); },
                  }, 'Import study guide'),
                ]) : null,
              ]),
            ] : null,
          ]),
      ]),
    ]);
  },
});
