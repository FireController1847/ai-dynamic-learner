import { computed, defineComponent, h, ref } from 'vue';
import { PopupDialog } from '../../components/popup-dialog.ts';
import { inputValue } from '../../core/dom.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_BULLETS, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from './library-model.ts';

const IMPORT_FORMAT = 'dynamic-learner-study-guide';
const IMPORT_VERSION = 1;

type PromptDetail = 'concise' | 'balanced' | 'detailed';
type PromptCoverage = 'essentials' | 'balanced' | 'comprehensive';
type PromptBulletStyle = 'phrases' | 'thoughts';

export interface StudyGuideAiPromptOptions {
  detail: PromptDetail;
  coverage: PromptCoverage;
  bulletStyle: PromptBulletStyle;
}

export interface SimpleStudyGuideImport {
  title: string;
  bullets: string[];
}

const DEFAULT_PROMPT_OPTIONS: StudyGuideAiPromptOptions = {
  detail: 'balanced',
  coverage: 'balanced',
  bulletStyle: 'thoughts',
};

const DETAIL_INSTRUCTIONS: Record<PromptDetail, string> = {
  concise: 'Keep bullets very concise. Prefer one short sentence or compact statement per bullet.',
  balanced: 'Keep bullets concise but include enough context to make each point useful for studying.',
  detailed: 'Include useful supporting detail in each bullet while keeping each bullet focused on one study point.',
};

const COVERAGE_INSTRUCTIONS: Record<PromptCoverage, string> = {
  essentials: 'Include only the most important concepts, facts, definitions, or relationships needed to understand the source.',
  balanced: 'Cover the major ideas and important supporting details without trying to reproduce every minor point.',
  comprehensive: 'Cover the source comprehensively, including important supporting details, distinctions, and terminology when they are useful for studying.',
};

const BULLET_STYLE_INSTRUCTIONS: Record<PromptBulletStyle, string> = {
  phrases: 'Prefer compact key phrases where they remain understandable on their own.',
  thoughts: 'Write bullets as complete, self-contained thoughts that make sense without rereading the source.',
};

export function studyGuideAiPrompt(options: StudyGuideAiPromptOptions = DEFAULT_PROMPT_OPTIONS): string {
  return `Using the source material I supplied immediately before this instruction, create a simple Dynamic Learner Study Guide.

Return ONLY valid JSON. Do not use Markdown code fences, commentary, citations outside the bullet text, or extra fields.

Use exactly this format:
{
  "format": "${IMPORT_FORMAT}",
  "version": ${IMPORT_VERSION},
  "title": "Short study guide title",
  "bullets": [
    "Concise fact or idea",
    "Another concise fact or idea"
  ]
}

Study-guide preferences:
- ${DETAIL_INSTRUCTIONS[options.detail]}
- ${COVERAGE_INSTRUCTIONS[options.coverage]}
- ${BULLET_STYLE_INSTRUCTIONS[options.bulletStyle]}

Rules:
- title must be non-empty and at most ${MAX_NAME_LENGTH} characters.
- bullets must contain at least one item and no more than ${MAX_BULLETS} items.
- each bullet must be non-empty, plain text, and at most ${MAX_TEXT_LENGTH} characters.
- preserve important terminology from the source.
- keep each bullet focused on one useful study point.
- do not invent facts not supported by the source.
- do not generate IDs, layout information, groups, maps, or other Dynamic Learner fields.
- base the study guide only on the source material supplied before this instruction.`;
}

export function parseStudyGuideAiImport(text: string): SimpleStudyGuideImport {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The pasted content is not valid JSON.');
  }

  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['format', 'version', 'title', 'bullets'].includes(key)) ||
      value.format !== IMPORT_FORMAT || value.version !== IMPORT_VERSION ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      !Array.isArray(value.bullets) || !value.bullets.length || value.bullets.length > MAX_BULLETS) {
    throw new Error('This is not a supported simple Study Guide import.');
  }

  const bullets = value.bullets.map((bullet, index) => {
    if (typeof bullet !== 'string' || !bullet.trim() || bullet.length > MAX_TEXT_LENGTH) {
      throw new Error(`Bullet ${index + 1} is empty, too long, or invalid.`);
    }
    return bullet.trim();
  });

  return { title: value.title.trim(), bullets };
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
        copyStatus.value = 'Copy failed. Select the prompt and copy it manually.';
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
      default: () => h('div', { style: { display: 'grid', gap: '14px' } }, [
        h('div', { role: 'tablist', 'aria-label': 'Study Guide import method', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
          tabButton('prompt', 'AI Prompt'),
          tabButton('import', 'JSON Import'),
        ]),
        tab.value === 'prompt'
          ? h('section', { role: 'tabpanel', style: { display: 'grid', gap: '12px' } }, [
            h('p', { style: { margin: '0', color: 'var(--text-secondary)' } },
              'First give the AI the source material you want to study. Then paste this prompt after the material. Paste the returned JSON into the JSON Import tab.'),
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
            h('textarea', {
              value: prompt.value,
              readonly: true,
              rows: 17,
              'aria-label': 'AI Study Guide prompt',
              style: { width: '100%', minHeight: '290px', resize: 'vertical', padding: '10px' },
            }),
            h('div', { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' } }, [
              h('button', { type: 'button', class: 'card-primary-button', onClick: copyPrompt }, 'Copy prompt'),
              copyStatus.value ? h('span', { role: 'status', style: { color: 'var(--text-secondary)', fontSize: '12px' } }, copyStatus.value) : null,
            ]),
          ])
          : h('section', { role: 'tabpanel', style: { display: 'grid', gap: '10px' } }, [
            h('p', { style: { margin: '0', color: 'var(--text-secondary)' } },
              'Paste the JSON returned by the AI. Dynamic Learner validates it before creating anything.'),
            h('textarea', {
              value: json.value,
              rows: 12,
              placeholder: '{\n  "format": "dynamic-learner-study-guide",\n  ...\n}',
              'aria-label': 'Study Guide JSON import',
              style: { width: '100%', minHeight: '220px', resize: 'vertical', padding: '10px', fontFamily: 'monospace' },
              onInput: (event: Event) => {
                json.value = inputValue(event);
                candidate.value = null;
                problem.value = '';
              },
            }),
            h('div', { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' } }, [
              h('button', { type: 'button', class: 'quiet-button', disabled: !json.value.trim(), onClick: preview }, 'Validate JSON'),
              problem.value ? h('span', { role: 'alert', style: { color: 'var(--danger)' } }, problem.value) : null,
            ]),
            candidate.value ? h('div', {
              style: { display: 'grid', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--surface-subtle)' },
            }, [
              h('strong', candidate.value.title),
              h('span', { style: { color: 'var(--text-secondary)', fontSize: '12px' } }, `${candidate.value.bullets.length} bullet${candidate.value.bullets.length === 1 ? '' : 's'} ready to import`),
              h('ul', { style: { margin: '0', paddingLeft: '20px' } }, [
                ...candidate.value.bullets.slice(0, 5).map((bullet) => h('li', bullet)),
                candidate.value.bullets.length > 5 ? h('li', `…and ${candidate.value.bullets.length - 5} more`) : null,
              ]),
              h('button', {
                type: 'button', class: 'card-primary-button', style: { justifySelf: 'start' },
                onClick: () => { if (candidate.value) emit('import', candidate.value); },
              }, 'Import study guide'),
            ]) : null,
          ]),
      ]),
    });
  },
});
