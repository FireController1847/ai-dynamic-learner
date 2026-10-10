import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { inputValue } from '../../core/dom.ts';
import { isRecord } from '../../core/validation.ts';
import {
  MAP_GRID, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH,
  MAX_BULLETS, MAX_NAME_LENGTH, MAX_SECTIONS, MAX_TEXT_LENGTH, MAX_TOPICS, type GuideMode,
} from './library-model.ts';

const LIST_IMPORT_FORMAT = 'dynamic-learner-guide';
const MAP_IMPORT_FORMAT = 'dynamic-learner-guide-map';
const LEGACY_LIST_IMPORT_FORMAT = 'dynamic-learner-study-guide';
const LEGACY_MAP_IMPORT_FORMAT = 'dynamic-learner-study-guide-map';
const IMPORT_VERSION = 1;
const MAX_IMPORT_BULLET_DEPTH = 7;
const JSON_FENCE = '```';

type PromptDetail = 'concise' | 'balanced' | 'detailed';
type PromptCoverage = 'essentials' | 'balanced' | 'comprehensive';
type PromptBulletStyle = 'phrases' | 'thoughts';

export interface GuideAiPromptOptions {
  detail: PromptDetail;
  coverage: PromptCoverage;
  bulletStyle: PromptBulletStyle;
}

export interface SimpleGuideImportSection {
  title: string;
  bullets: string[];
}

export interface SimpleListGuideImport {
  mode: 'list';
  title: string;
  sections: SimpleGuideImportSection[];
}

export interface SimpleMapGuideImportTopic {
  key: string;
  title: string;
  description?: string;
  position?: readonly [number, number];
  sections: SimpleGuideImportSection[];
}

export interface SimpleMapGuideImport {
  mode: 'map';
  title: string;
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

Condense freely when several facts can be represented by one useful note. Prefer losing low-value detail over making the guide long.

Do NOT include citations, references, footnotes, source annotations, source lists, or citation/source URLs anywhere in the response. Do not emit ChatGPT citation markers or content-reference tokens such as :chatgpt-content-reference{...}, :contentReference[...]{...}, or cite.... Omit citations even if the source material contains them. The JSON must contain study content only.`;
}

function listPrompt(options: GuideAiPromptOptions): string {
  return `${promptIntro(options, 'list')}

Return ONLY one fenced JSON code block, starting with ${JSON_FENCE}json and ending with ${JSON_FENCE}.

Use this structure:
${JSON_FENCE}json
{
  "format": "${LIST_IMPORT_FORMAT}",
  "version": ${IMPORT_VERSION},
  "title": "Short guide title",
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
  return `${promptIntro(options, 'map')}

Create a connected topic map that feels like an adventurous path the learner can explore, not a plain outline drawn as boxes. Each topic is a study stop with its own small list-style guide and an optional short introduction. Put the topics in a useful learning order so one stop naturally leads to the next.

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
  "title": "Short guide title",
  "startTopic": "foundations",
  "topics": [
    {
      "key": "foundations",
      "description": "Begin with the core ideas that make the rest of the journey easier to understand.",
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
      "description": "Now explore how those foundations connect and work together in practice.",
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
      "description": "See why the earlier concepts matter when they are put to use.",
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
      "description": "Take an optional detour to see these ideas through one concrete example.",
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
- usually include a short "description" for each topic: one or two plain-text sentences explaining why this stop belongs on the journey and what kind of ideas will be revealed;
- descriptions should set context and curiosity, not merely repeat the title, list the forthcoming bullets, or spoil the entire content; omit the description when it would be filler;
- each topic's sections and nested bullets use the same note structure as List mode;
- preserve important terminology and factual accuracy;
- do not invent unsupported information.

Limits:
- title: 1–${MAX_NAME_LENGTH} characters;
- 1–${MAX_TOPICS} topics;
- each topic supports up to ${MAX_SECTIONS} sections and ${MAX_BULLETS} bullets/sub-bullets;
- topic titles, section titles, bullet text, and topic keys must be non-empty plain text no longer than ${MAX_TEXT_LENGTH} characters;
- optional topic descriptions must be plain text no longer than ${MAX_TEXT_LENGTH} characters (normally just 1–2 short sentences);
- at most ${MAX_IMPORT_BULLET_DEPTH + 1} bullet levels;
- do not generate Dynamic Learner IDs, groups, or other application fields. Dynamic Learner validates suggested positions and owns the stored map data.`;
}

export function guideAiPrompt(
  options: GuideAiPromptOptions = DEFAULT_PROMPT_OPTIONS,
  mode: GuideMode = 'list',
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
    throw new Error('The pasted content is not valid JSON.');
  }
}

function parseListImport(value: unknown): SimpleListGuideImport {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'sections'].includes(key)) ||
      (value.format !== LIST_IMPORT_FORMAT && value.format !== LEGACY_LIST_IMPORT_FORMAT) || value.version !== IMPORT_VERSION ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH) {
    throw new Error('This is not a supported List-mode Guide import.');
  }
  const state = { count: 0 };
  return {
    mode: 'list',
    title: value.title.trim(),
    sections: parseImportSections(value.sections, state, 'Guide'),
  };
}

function parseMapImport(value: unknown): SimpleMapGuideImport {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'startTopic', 'topics', 'connections'].includes(key)) ||
      (value.format !== MAP_IMPORT_FORMAT && value.format !== LEGACY_MAP_IMPORT_FORMAT) || value.version !== IMPORT_VERSION ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      typeof value.startTopic !== 'string' || !value.startTopic.trim() ||
      !Array.isArray(value.topics) || !value.topics.length || value.topics.length > MAX_TOPICS ||
      !Array.isArray(value.connections)) {
    throw new Error('This is not a supported Map-mode Guide import.');
  }

  const keys = new Set<string>();
  const topics = value.topics.map((topic, topicIndex): SimpleMapGuideImportTopic => {
    if (!isRecord(topic) ||
        Object.keys(topic).some((key) => !['key', 'title', 'description', 'position', 'sections'].includes(key)) ||
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
    const position = Array.isArray(topic.position)
      ? [topic.position[0] as number, topic.position[1] as number] as const
      : undefined;
    return {
      key,
      title: topic.title.trim(),
      ...(typeof topic.description === 'string' && topic.description.trim() ? { description: topic.description.trim() } : {}),
      position,
      sections: parseImportSections(topic.sections, { count: 0 }, `Topic ${topicIndex + 1}`),
    };
  });

  const positionedTopics = topics.filter(topic => topic.position !== undefined);
  if (positionedTopics.length !== 0 && positionedTopics.length !== topics.length) {
    throw new Error('Map-mode AI positions must be provided for every topic or omitted for every topic.');
  }
  for (let firstIndex = 0; firstIndex < positionedTopics.length; firstIndex += 1) {
    const first = positionedTopics[firstIndex];
    if (!first?.position) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < positionedTopics.length; secondIndex += 1) {
      const second = positionedTopics[secondIndex];
      if (!second?.position) continue;
      const overlaps =
        first.position[0] < second.position[0] + MAP_TOPIC_WIDTH &&
        first.position[0] + MAP_TOPIC_WIDTH > second.position[0] &&
        first.position[1] < second.position[1] + MAP_TOPIC_HEIGHT &&
        first.position[1] + MAP_TOPIC_HEIGHT > second.position[1];
      if (overlaps) throw new Error(`Map topics "${first.title}" and "${second.title}" overlap.`);
    }
  }

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

  return { mode: 'map', title: value.title.trim(), startTopic, topics, connections };
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
  },
  emits: { back: () => true, cancel: () => true, import: (_value: SimpleGuideImport) => true },
  setup(props, { emit }) {
    const detail = ref<PromptDetail>(DEFAULT_PROMPT_OPTIONS.detail);
    const coverage = ref<PromptCoverage>(DEFAULT_PROMPT_OPTIONS.coverage);
    const bulletStyle = ref<PromptBulletStyle>(DEFAULT_PROMPT_OPTIONS.bulletStyle);
    const json = ref('');
    const problem = ref('');
    const candidate = ref<SimpleGuideImport | null>(null);
    const prompt = computed(() => guideAiPrompt({ detail: detail.value, coverage: coverage.value, bulletStyle: bulletStyle.value }, props.mode));
    function preview() {
      candidate.value = null;
      problem.value = '';
      try { candidate.value = parseGuideAiImport(json.value, props.mode); }
      catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function optionField<T extends string>(
      id: string,
      label: string,
      value: T,
      options: readonly { value: T; label: string }[],
      change: (value: T) => void,
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
      ]);
    }

    function importPreview(value: SimpleGuideImport) {
      if (value.mode === 'list') {
        return [
          h('strong', value.title),
          h('span', { class: 'guide-ai-status' },
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
        h('span', { class: 'guide-ai-status' },
          `${value.topics.length} topic${value.topics.length === 1 ? '' : 's'} · ${value.connections.length} path${value.connections.length === 1 ? '' : 's'} · ${mapBulletCount(value)} bullets and sub-bullets`),
        h('span', { class: 'guide-ai-status' }, 'Starts at ' + (start?.title ?? value.startTopic)),
        h('ul', [
          ...value.topics.slice(0, 5).map(topic =>
            h('li', `${topic.title} — ${topic.sections.length} section${topic.sections.length === 1 ? '' : 's'}`)),
          value.topics.length > 5 ? h('li', `…and ${value.topics.length - 5} more topics`) : null,
        ]),
      ];
    }

    return () => h('section', { class: 'guide-ai-workspace', 'aria-labelledby': 'guide-ai-title' }, [
      h('header', { class: 'guide-ai-header' }, [
        h('div', { class: 'guide-ai-heading' }, [
          h('span', { class: 'guide-ai-kicker' }, `${props.mode === 'map' ? 'Map mode' : 'List mode'} · Saved in ${props.destination}`),
          h('h2', { id: 'guide-ai-title' }, 'Create with AI'),
          h('p', 'Generate a prompt for your AI, then paste its JSON response back here to create the guide.'),
        ]),
        h('div', { class: 'guide-ai-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        ]),
      ]),
      h(AiPromptExchange, {
        idPrefix: 'guide-ai', label: 'Guide', prompt: prompt.value, json: json.value, problem: problem.value,
        hasPreview: candidate.value !== null,
        promptHelp: 'Give the AI the source material first, then send this prompt to create your guide.',
        importHelp: 'Wait for the AI response, then paste its JSON here. Dynamic Learner validates the content before creating the guide.',
        readyInstructions: ['Paste the Guide JSON below.', 'Choose Validate JSON.', 'Review the preview, then choose Import guide.'],
        onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; },
        onValidate: preview,
      }, {
        options: () => h('div', { class: 'guide-ai-options' }, [
              optionField('guide-ai-detail', 'Detail', detail.value, [
                { value: 'concise', label: 'Concise' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'detailed', label: 'Detailed' },
              ], (value) => { detail.value = value; }),
              optionField('guide-ai-coverage', 'Coverage', coverage.value, [
                { value: 'essentials', label: 'Essentials only' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'comprehensive', label: 'Comprehensive' },
              ], (value) => { coverage.value = value; }),
              optionField('guide-ai-bullet-style', 'Bullet style', bulletStyle.value, [
                { value: 'phrases', label: 'Key phrases' },
                { value: 'thoughts', label: 'Complete thoughts' },
              ], (value) => { bulletStyle.value = value; }),
            ]),
        preview: () => candidate.value ? h('div', { class: 'guide-ai-preview' }, [
          ...importPreview(candidate.value),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => { if (candidate.value) emit('import', candidate.value); } }, 'Import guide'),
        ]) : null,
      }),
    ]);
  },
});
