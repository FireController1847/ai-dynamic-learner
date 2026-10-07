import { defineComponent, h, ref } from 'vue';
import { PopupDialog } from '../../components/popup-dialog.ts';
import { inputValue } from '../../core/dom.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_BULLETS, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from './library-model.ts';

const IMPORT_FORMAT = 'dynamic-learner-study-guide';
const IMPORT_VERSION = 1;

export interface SimpleStudyGuideImport {
  title: string;
  bullets: string[];
}

export function studyGuideAiPrompt(): string {
  return `Create a simple Dynamic Learner Study Guide from source material I provide after this prompt.

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

Rules:
- title must be non-empty and at most ${MAX_NAME_LENGTH} characters.
- bullets must contain at least one item and no more than ${MAX_BULLETS} items.
- each bullet must be non-empty, plain text, and at most ${MAX_TEXT_LENGTH} characters.
- preserve important terminology from the source.
- keep each bullet focused on one useful study point.
- do not invent facts not supported by the source.
- do not generate IDs, layout information, groups, maps, or other Dynamic Learner fields.

After this prompt, I will provide a URL, pasted text, notes, or other source material.`;
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
    const json = ref('');
    const problem = ref('');
    const copyStatus = ref('');
    const candidate = ref<SimpleStudyGuideImport | null>(null);
    const prompt = studyGuideAiPrompt();

    async function copyPrompt() {
      try {
        await navigator.clipboard.writeText(prompt);
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
          ? h('section', { role: 'tabpanel', style: { display: 'grid', gap: '10px' } }, [
            h('p', { style: { margin: '0', color: 'var(--text-secondary)' } },
              'Copy this prompt into the AI you want to use, then give it your source material. Paste the returned JSON into the JSON Import tab.'),
            h('textarea', {
              value: prompt,
              readonly: true,
              rows: 15,
              'aria-label': 'AI Study Guide prompt',
              style: { width: '100%', minHeight: '260px', resize: 'vertical', padding: '10px' },
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
