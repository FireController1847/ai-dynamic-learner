import { computed, defineComponent, h, ref } from 'vue';
import { Icon } from '../../components/icon.ts';
import { inputValue } from '../../core/dom.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_BULLETS, MAX_NAME_LENGTH, MAX_SECTIONS, MAX_TEXT_LENGTH } from './library-model.ts';

const IMPORT_FORMAT = 'dynamic-learner-study-guide';
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

export interface SimpleStudyGuideImport {
  title: string;
  sections: SimpleStudyGuideImportSection[];
}

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

export function studyGuideAiPrompt(options: StudyGuideAiPromptOptions = DEFAULT_PROMPT_OPTIONS): string {
  return `Using the source material I supplied immediately before this instruction, create a Dynamic Learner Study Guide.

Write in the style of a capable student taking organized notes during class: compact, practical, and easy to scan. This is a study guide, not a rewritten textbook or transcript.

Silently organize the source into a logical outline, then classify possible study points as high, moderate, or low priority. Use that planning only to decide the final sections, bullets, and sub-bullets; do not output the planning itself.

Selected preferences:
- Detail: ${DETAIL_INSTRUCTIONS[options.detail]}
- Coverage: ${COVERAGE_INSTRUCTIONS[options.coverage]}
- Bullet style: ${BULLET_STYLE_INSTRUCTIONS[options.bulletStyle]}

Condense freely when several facts can be represented by one useful note. Prefer losing low-value detail over making the guide long.

Return ONLY one fenced JSON code block, starting with ${JSON_FENCE}json and ending with ${JSON_FENCE}.

Use this structure:
${JSON_FENCE}json
{
  "format": "${IMPORT_FORMAT}",
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
    throw new Error(`A Study Guide can contain up to ${MAX_BULLETS} bullets and sub-bullets.`);
  }

  const flattened = [`${'\t'.repeat(depth)}${value.text.trim()}`];
  if (Array.isArray(value.children)) {
    value.children.forEach((child, index) => {
      flattened.push(...parseImportBullet(child, depth + 1, state, `${label} child ${index + 1}`));
    });
  }
  return flattened;
}

function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = /^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

export function parseStudyGuideAiImport(text: string): SimpleStudyGuideImport {
  let value: unknown;
  try {
    value = JSON.parse(stripJsonCodeFence(text));
  } catch {
    throw new Error('The pasted content is not valid JSON.');
  }

  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'sections'].includes(key)) ||
      value.format !== IMPORT_FORMAT || value.version !== IMPORT_VERSION ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      !Array.isArray(value.sections) || !value.sections.length || value.sections.length > MAX_SECTIONS) {
    throw new Error('This is not a supported Study Guide import.');
  }

  const state = { count: 0 };
  const sections = value.sections.map((section, sectionIndex): SimpleStudyGuideImportSection => {
    if (!isRecord(section) ||
        Object.keys(section).some((key) => !['title', 'bullets'].includes(key)) ||
        typeof section.title !== 'string' || !section.title.trim() || section.title.trim().length > MAX_TEXT_LENGTH ||
        !Array.isArray(section.bullets) || !section.bullets.length) {
      throw new Error(`Section ${sectionIndex + 1} is empty, too long, or invalid.`);
    }

    const bullets = section.bullets.flatMap((bullet, bulletIndex) =>
      parseImportBullet(bullet, 0, state, `Section ${sectionIndex + 1}, bullet ${bulletIndex + 1}`));

    return { title: section.title.trim(), bullets };
  });

  return { title: value.title.trim(), sections };
}

function importBulletCount(value: SimpleStudyGuideImport): number {
  return value.sections.reduce((count, section) => count + section.bullets.length, 0);
}

export const StudyGuideAiImportWorkspace = defineComponent({
  name: 'StudyGuideAiImportWorkspace',
  props: {
    destination: { type: String, required: true },
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
    const candidate = ref<SimpleStudyGuideImport | null>(null);
    const prompt = computed(() => studyGuideAiPrompt({
      detail: detail.value,
      coverage: coverage.value,
      bulletStyle: bulletStyle.value,
    }));

    async function copyPrompt() {
      try {
        await navigator.clipboard.writeText(prompt.value);
        copyStatus.value = 'Prompt copied.';
      } catch {
        showPrompt.value = true;
        copyStatus.value = 'Copy failed. The prompt is shown below so you can copy it manually.';
      }
    }

    function preview() {
      problem.value = '';
      candidate.value = null;
      try {
        candidate.value = parseStudyGuideAiImport(json.value);
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

    return () => h('section', {
      class: 'study-guide-ai-workspace',
      'aria-labelledby': 'study-guide-ai-title',
    }, [
      h('header', { class: 'study-guide-ai-header' }, [
        h('div', { class: 'study-guide-ai-heading' }, [
          h('span', { class: 'study-guide-ai-kicker' }, 'List mode · Saved in ' + props.destination),
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
              'Give the AI the source material first. Then paste this generated prompt after it. Paste the returned JSON into the JSON Import tab.'),
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
                h('button', { type: 'button', class: 'card-primary-button', onClick: copyPrompt }, 'Copy prompt'),
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
            h('p', { class: 'study-guide-ai-help' },
              'Paste the JSON code block returned by the AI. Dynamic Learner removes the code fence if present and validates the JSON before creating anything.'),
            h('textarea', {
              value: json.value,
              rows: 12,
              placeholder: '{\n  "format": "dynamic-learner-study-guide",\n  "sections": [\n    ...\n  ]\n}',
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
                h('strong', candidate.value.title),
                h('span', { class: 'study-guide-ai-status' },
                  `${candidate.value.sections.length} section${candidate.value.sections.length === 1 ? '' : 's'} · ${importBulletCount(candidate.value)} bullets and sub-bullets`),
                h('ul', [
                  ...candidate.value.sections.slice(0, 5).map((section) =>
                    h('li', `${section.title} — ${section.bullets.length} item${section.bullets.length === 1 ? '' : 's'}`)),
                  candidate.value.sections.length > 5
                    ? h('li', `…and ${candidate.value.sections.length - 5} more sections`)
                    : null,
                ]),
                h('button', {
                  type: 'button',
                  class: 'card-primary-button',
                  onClick: () => { if (candidate.value) emit('import', candidate.value); },
                }, 'Import study guide'),
              ]) : null,
            ]),
          ]),
      ]),
    ]);
  },
});
