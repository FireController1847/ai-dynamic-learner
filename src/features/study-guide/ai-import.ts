import { computed, defineComponent, h, ref } from 'vue';
import { Icon } from '../../components/icon.ts';
import { PopupDialog } from '../../components/popup-dialog.ts';
import { inputValue } from '../../core/dom.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_BULLETS, MAX_NAME_LENGTH, MAX_SECTIONS, MAX_TEXT_LENGTH } from './library-model.ts';

const IMPORT_FORMAT = 'dynamic-learner-study-guide';
const IMPORT_VERSION = 1;
const MAX_IMPORT_BULLET_DEPTH = 7;

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
  concise: 'Compress each point aggressively. Keep only the information needed to recognize and recall the concept.',
  balanced: 'Keep each point compact while preserving enough context to make it useful for studying.',
  detailed: 'Include useful supporting detail, distinctions, and context while keeping each individual point focused.',
};

const COVERAGE_INSTRUCTIONS: Record<PromptCoverage, string> = {
  essentials: 'Include only the most important concepts, facts, definitions, and relationships needed to understand the source.',
  balanced: 'Cover the major ideas and important supporting details without trying to reproduce every minor point.',
  comprehensive: 'Cover the source comprehensively, including important supporting details, distinctions, terminology, and relationships that are useful for studying.',
};

const BULLET_STYLE_INSTRUCTIONS: Record<PromptBulletStyle, string> = {
  phrases: 'Use compact key phrases of about 5–10 words per bullet or sub-bullet. Remove filler words and sentence framing whenever meaning remains clear.',
  thoughts: 'Express each bullet or sub-bullet as one self-contained idea in as few words as practical.',
};

function fullSentencesAllowed(options: StudyGuideAiPromptOptions): boolean {
  return options.detail === 'detailed' &&
    options.coverage === 'comprehensive' &&
    options.bulletStyle === 'thoughts';
}

export function studyGuideAiPrompt(options: StudyGuideAiPromptOptions = DEFAULT_PROMPT_OPTIONS): string {
  const sentenceRule = fullSentencesAllowed(options)
    ? 'Full sentences are allowed because Detailed + Comprehensive + Complete thoughts is selected, but still keep each bullet focused and economical.'
    : 'Do NOT use full sentences. Use concise phrases or fragments; full sentences are reserved for Detailed + Comprehensive + Complete thoughts mode.';

  return `Using the source material I supplied immediately before this instruction, create a Dynamic Learner Study Guide.

Return ONLY valid JSON. Do not use Markdown code fences, commentary, citations outside the bullet text, or extra fields.

Before writing the JSON, silently make a mini table of contents for the source. Organize the material into a logical hierarchy of major sections, subsections, sub-subsections, and deeper levels when useful. Do not output that planning outline separately. Use it to structure the JSON:
- top-level topics become entries in "sections";
- each section gets a short, meaningful title;
- lower-level concepts become bullets and nested "children";
- use sub-bullets when they clarify that information belongs under a broader idea;
- prefer a logical study order over blindly copying the source's original order when reorganization improves understanding;
- do not force nesting when ideas are genuinely peers.

Use exactly this format:
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
            {
              "text": "Supporting detail"
            }
          ]
        },
        {
          "text": "Another key idea"
        }
      ]
    }
  ]
}

Study-guide preferences:
- ${DETAIL_INSTRUCTIONS[options.detail]}
- ${COVERAGE_INSTRUCTIONS[options.coverage]}
- ${BULLET_STYLE_INSTRUCTIONS[options.bulletStyle]}
- ${sentenceRule}

Rules:
- title must be non-empty and at most ${MAX_NAME_LENGTH} characters.
- sections must contain at least one item and no more than ${MAX_SECTIONS} items.
- every section title must be non-empty plain text and at most ${MAX_TEXT_LENGTH} characters.
- the entire guide may contain no more than ${MAX_BULLETS} bullets and sub-bullets.
- every bullet object must contain a non-empty "text" string and may contain a "children" array.
- each bullet text must be plain text and at most ${MAX_TEXT_LENGTH} characters.
- nested bullets may be at most ${MAX_IMPORT_BULLET_DEPTH + 1} levels deep.
- preserve important terminology from the source.
- keep each bullet focused on one useful study point.
- do not invent facts not supported by the source.
- do not generate IDs, layout information, groups, maps, or other Dynamic Learner fields.
- base the study guide only on the source material supplied before this instruction.`;
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

export function parseStudyGuideAiImport(text: string): SimpleStudyGuideImport {
  let value: unknown;
  try {
    value = JSON.parse(text);
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

export const StudyGuideAiImportDialog = defineComponent({
  name: 'StudyGuideAiImportDialog',
  emits: {
    close: () => true,
    import: (_value: SimpleStudyGuideImport) => true,
  },
  setup(_props, { emit }) {
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
      style: tab.value === id ? { borderColor: 'var(--brand)', background: 'var(--brand-tint)', color: 'var(--brand-text)' } : null,
      onClick: () => selectTab(id),
    }, label);

    function optionField<T extends string>(
      id: string,
      label: string,
      value: T,
      options: readonly { value: T; label: string }[],
      change: (value: T) => void,
    ) {
      return h('label', { for: id, style: { display: 'grid', gap: '4px' } }, [
        h('span', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, label),
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

    return () => h(PopupDialog, {
      title: 'AI / JSON import',
      headingId: 'study-guide-ai-import-title',
      width: 680,
      onClose: () => emit('close'),
    }, {
      default: () => h('div', {
        style: { display: 'grid', gap: '14px', minHeight: '540px', alignContent: 'start' },
      }, [
        h('div', { role: 'tablist', 'aria-label': 'Study Guide import method', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
          tabButton('prompt', 'AI Prompt'),
          tabButton('import', 'JSON Import'),
        ]),
        tab.value === 'prompt'
          ? h('section', { role: 'tabpanel', style: { display: 'grid', gap: '12px', alignContent: 'start' } }, [
            h('p', { style: { margin: '0', color: 'var(--text-secondary)' } },
              'Give the AI the source material first. After the source material, paste this generated prompt. Then paste the AI\'s returned JSON into the JSON Import tab.'),
            h('div', {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '10px',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-subtle)',
              },
            }, [
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
            h('div', { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } }, [
              h('div', { style: { display: 'inline-flex', alignItems: 'stretch', gap: '4px' } }, [
                h('button', { type: 'button', class: 'card-primary-button', onClick: copyPrompt }, 'Copy prompt'),
                h('button', {
                  type: 'button',
                  class: 'quiet-button',
                  title: showPrompt.value ? 'Hide prompt' : 'Show prompt',
                  'aria-label': showPrompt.value ? 'Hide generated prompt' : 'Show generated prompt',
                  'aria-expanded': showPrompt.value,
                  'aria-controls': 'study-guide-ai-prompt-preview',
                  style: { minWidth: '36px', paddingInline: '7px' },
                  onClick: () => { showPrompt.value = !showPrompt.value; },
                }, [h(Icon, { name: showPrompt.value ? 'chevron-up' : 'chevron-down' })]),
              ]),
              copyStatus.value ? h('span', { role: 'status', style: { color: 'var(--text-secondary)', fontSize: '12px' } }, copyStatus.value) : null,
            ]),
            showPrompt.value ? h('textarea', {
              id: 'study-guide-ai-prompt-preview',
              value: prompt.value,
              readonly: true,
              rows: 17,
              'aria-label': 'AI Study Guide prompt',
              style: { width: '100%', minHeight: '290px', resize: 'vertical', padding: '10px' },
            }) : null,
          ])
          : h('section', {
            role: 'tabpanel',
            style: { display: 'grid', gap: '10px', minHeight: '480px', alignContent: 'start' },
          }, [
            h('p', { style: { margin: '0', color: 'var(--text-secondary)' } },
              'Paste the JSON returned by the AI. Dynamic Learner validates it before creating anything.'),
            h('textarea', {
              value: json.value,
              rows: 12,
              placeholder: '{\n  "format": "dynamic-learner-study-guide",\n  "sections": [\n    ...\n  ]\n}',
              'aria-label': 'Study Guide JSON import',
              style: { width: '100%', height: '220px', minHeight: '220px', resize: 'vertical', padding: '10px', fontFamily: 'monospace' },
              onInput: (event: Event) => {
                json.value = inputValue(event);
                candidate.value = null;
                problem.value = '';
              },
            }),
            h('div', { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', minHeight: '32px' } }, [
              h('button', { type: 'button', class: 'quiet-button', disabled: !json.value.trim(), onClick: preview }, 'Validate JSON'),
              problem.value ? h('span', { role: 'alert', style: { color: 'var(--danger)' } }, problem.value) : null,
            ]),
            h('div', { style: { minHeight: '154px' } }, [
              candidate.value ? h('div', {
                style: { display: 'grid', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--surface-subtle)' },
              }, [
                h('strong', candidate.value.title),
                h('span', { style: { color: 'var(--text-secondary)', fontSize: '12px' } },
                  `${candidate.value.sections.length} section${candidate.value.sections.length === 1 ? '' : 's'} · ${importBulletCount(candidate.value)} bullets and sub-bullets`),
                h('ul', { style: { margin: '0', paddingLeft: '20px' } }, [
                  ...candidate.value.sections.slice(0, 5).map((section) =>
                    h('li', `${section.title} — ${section.bullets.length} item${section.bullets.length === 1 ? '' : 's'}`)),
                  candidate.value.sections.length > 5
                    ? h('li', `…and ${candidate.value.sections.length - 5} more sections`)
                    : null,
                ]),
                h('button', {
                  type: 'button', class: 'card-primary-button', style: { justifySelf: 'start' },
                  onClick: () => { if (candidate.value) emit('import', candidate.value); },
                }, 'Import study guide'),
              ]) : null,
            ]),
          ]),
      ]),
    });
  },
});
