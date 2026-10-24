import { defineComponent, h, ref, type PropType } from 'vue';
import type { AiSubjectCoverage } from '../core/ai-subject-coverage.ts';

export const AiCoverageAcceptance = defineComponent({
  name: 'AiCoverageAcceptance',
  props: {
    coverage: { type: Array as PropType<AiSubjectCoverage[]>, required: true },
    items: { type: Array as PropType<string[]>, required: true },
  },
  emits: { approval: (_value: boolean) => true },
  setup(props, { emit }) {
    const checked = ref<number[]>([]);
    const compared = ref(false);
    const missing = ref('');
    const reported = ref<string[]>([]);
    function notify() { emit('approval', compared.value && checked.value.length === props.coverage.length && !reported.value.length); }
    const correction = () => 'Recheck the ORIGINAL source and regenerate the COMPLETE JSON. Missing subjects: ' + reported.value.join('; ') +
      '. Cover every source topic with meaningful entries, preserve all already covered subjects, update coverage itemNumbers, and return the full corrected JSON.';
    return () => h('section', { class: 'review-ai-coverage', 'aria-label': 'Subject coverage acceptance' }, [
      h('h3', 'Review every covered subject'),
      h('p', { class: 'study-ai-muted' }, 'AI-reported subjects are not proof of completeness. Compare each item with your original study guide, every heading and every bullet.'),
      h('p', { role: 'status' }, checked.value.length + ' of ' + props.coverage.length + ' subjects accepted'),
      h('div', { class: 'review-ai-coverage-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => { checked.value = props.coverage.map((_, i) => i); notify(); } }, 'Accept all listed'),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => { checked.value = []; compared.value = false; notify(); } }, 'Reset'),
      ]),
      h('ul', { class: 'review-ai-coverage-list' }, props.coverage.map((item, index) => h('li', { key: index }, [
        h('label', [
          h('input', { type: 'checkbox', checked: checked.value.includes(index), onChange: (event: Event) => {
            const yes = (event.target as HTMLInputElement).checked;
            checked.value = yes ? [...checked.value, index] : checked.value.filter(n => n !== index); notify();
          } }),
          h('strong', item.subject),
          h('span', { class: 'study-ai-muted' }, ' · Entries ' + item.itemNumbers.join(', ')),
        ]),
        h('details', [h('summary', 'Inspect matching entries'),
          h('ol', item.itemNumbers.map(n => h('li', { key: n }, props.items[n - 1] ?? 'Missing entry')))]),
      ]))),
      h('div', { class: 'review-ai-coverage-missing' }, [
        h('strong', 'Subject missing from the inventory?'),
        h('div', { class: 'review-ai-coverage-add' }, [
          h('input', { type: 'text', value: missing.value, maxlength: 160, placeholder: 'Missing subject',
            'aria-label': 'Missing source subject', onInput: (e: Event) => { missing.value = (e.target as HTMLInputElement).value; },
            onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); if (missing.value.trim()) { reported.value = [...reported.value, missing.value.trim()]; missing.value = ''; notify(); } } } }),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { if (missing.value.trim()) { reported.value = [...reported.value, missing.value.trim()]; missing.value = ''; notify(); } } }, 'Flag missing'),
        ]),
        reported.value.length ? h('ul', reported.value.map((name, index) => h('li', { key: index }, [
          name, h('button', { type: 'button', class: 'quiet-button', onClick: () => { reported.value = reported.value.filter((_, i) => i !== index); notify(); } }, 'Remove'),
        ]))) : null,
        reported.value.length ? h('div', [
          h('p', 'Copy this correction request into your original AI conversation, then reimport the complete response.'),
          h('textarea', { readonly: true, value: correction(), rows: 4, 'aria-label': 'Correction request' }),
        ]) : null,
      ]),
      h('label', { class: 'review-ai-coverage-confirm' }, [
        h('input', { type: 'checkbox', checked: compared.value, onChange: (e: Event) => { compared.value = (e.target as HTMLInputElement).checked; notify(); } }),
        'I compared these subjects with the original source and checked for omissions.',
      ]),
      h('p', { class: 'study-ai-muted', role: 'status' },
        compared.value && checked.value.length === props.coverage.length && !reported.value.length
          ? 'All listed subjects accepted.' : 'Resolve missing subjects and accept the checklist to enable import.'),
    ]);
  },
});
