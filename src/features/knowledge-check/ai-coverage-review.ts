import { defineComponent, h, ref, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import type { ReviewAiSubjectCoverage } from './ai-import-format.ts';

/** Human confirmation of the AI's self-reported subject-to-question mapping. */
export const ReviewAiCoverageReview = defineComponent({
  name: 'ReviewAiCoverageReview',
  props: {
    coverage: { type: Array as PropType<ReviewAiSubjectCoverage[]>, required: true },
    questions: { type: Array as PropType<{ prompt: string }[]>, required: true },
  },
  emits: { approval: (_approved: boolean) => true },
  setup(props, { emit }) {
    const accepted = ref<string[]>([]);
    const sourceChecked = ref(false);
    const missing = ref<string[]>([]);
    const missingInput = ref('');
    const copyStatus = ref('');
    const showFallback = ref(false);
    function notify() {
      emit('approval', sourceChecked.value && !missing.value.length &&
        accepted.value.length === props.coverage.length);
    }
    function mark(subject: string, checked: boolean) {
      accepted.value = checked
        ? [...new Set([...accepted.value, subject])]
        : accepted.value.filter(name => name !== subject);
      notify();
    }
    function addMissing() {
      const name = missingInput.value.trim();
      if (!name || name.length > 120 ||
          [...props.coverage.map(item => item.subject), ...missing.value]
            .some(value => value.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
      missing.value = [...missing.value, name];
      missingInput.value = '';
      notify();
    }
    function correction() {
      return 'Review your original source again. The prior Dynamic Learner Review response omitted these subjects: ' +
        missing.value.join('; ') + '. Add meaningful scored questions covering ALL of them. Preserve existing covered topics, return the COMPLETE corrected Review JSON including the exhaustive top-level coverage array and corrected 1-based questionNumbers, and verify EVERY topic against the original source. Complete coverage takes precedence over question count. Return only JSON.';
    }
    async function requestCorrection() {
      copyStatus.value = '';
      showFallback.value = false;
      try {
        await navigator.clipboard.writeText(correction());
        copyStatus.value = 'Copied. Send this to the original AI chat, then paste and validate the complete corrected JSON.';
      } catch {
        showFallback.value = true;
        copyStatus.value = 'Copying was blocked. Copy the request below into the original AI chat.';
      }
    }
    return () => h('section', { class: 'review-ai-coverage', 'aria-label': 'Subject coverage review' }, [
      h('h4', 'Check every subject before creating'),
      h('p', { class: 'study-ai-muted' },
        'This list is reported by the AI, not independently verified. Compare it with every heading, objective, bullet, and topic in your original source, especially study guides.'),
      h('p', { class: 'study-ai-muted', role: 'status' },
        String(accepted.value.length) + ' of ' + String(props.coverage.length) + ' subjects accepted'),
      h('div', { class: 'review-ai-coverage-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => {
          accepted.value = props.coverage.map(item => item.subject); notify();
        } }, 'Accept all listed'),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => {
          accepted.value = []; sourceChecked.value = false; notify();
        } }, 'Reset checks'),
      ]),
      h('ul', { class: 'review-ai-coverage-list' }, props.coverage.map(item => h('li', { key: item.subject }, [
        h('label', [
          h('input', {
            type: 'checkbox', checked: accepted.value.includes(item.subject),
            onChange: (event: Event) => mark(item.subject, (event.target as HTMLInputElement).checked),
          }),
          h('span', [
            h('strong', item.subject),
            h('span', { class: 'study-ai-muted' }, 'Questions ' + item.questionNumbers.join(', ')),
          ]),
        ]),
        h('details', [
          h('summary', 'View matching questions'),
          h('ol', item.questionNumbers.map(number => h('li', { key: number },
            '#' + number + ': ' + (props.questions[number - 1]?.prompt ?? '')))),
        ]),
      ]))),
      h('section', { class: 'review-ai-coverage-missing' }, [
        h('strong', 'Missing a subject?'),
        h('div', { class: 'review-ai-coverage-add' }, [
          h('input', {
            type: 'text', value: missingInput.value, maxlength: 120,
            'aria-label': 'Subject omitted from the source coverage checklist',
            placeholder: 'Name the missing subject',
            onInput: (event: Event) => { missingInput.value = inputValue(event); },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter') { event.preventDefault(); addMissing(); }
            },
          }),
          h('button', { type: 'button', class: 'quiet-button', onClick: addMissing }, 'Flag missing'),
        ]),
        missing.value.length ? h('ul', missing.value.map(name => h('li', { key: name }, [
          h('span', name),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => {
            missing.value = missing.value.filter(value => value !== name); notify();
          } }, 'Remove flag'),
        ]))) : null,
        missing.value.length ? h('button', { type: 'button', class: 'quiet-button',
          onClick: requestCorrection }, 'Copy request to cover missing subjects') : null,
        copyStatus.value ? h('p', { role: 'status' }, copyStatus.value) : null,
        showFallback.value ? h('textarea', { readonly: true, rows: 5, value: correction(),
          'aria-label': 'Missing subjects correction request' }) : null,
      ]),
      h('label', { class: 'review-ai-coverage-confirm' }, [
        h('input', {
          type: 'checkbox', checked: sourceChecked.value,
          onChange: (event: Event) => {
            sourceChecked.value = (event.target as HTMLInputElement).checked; notify();
          },
        }),
        h('span', 'I compared this inventory with the original source and checked for omitted subjects.'),
      ]),
      sourceChecked.value && accepted.value.length === props.coverage.length && !missing.value.length
        ? h('p', { role: 'status' }, 'Coverage checklist accepted. You can create the set.')
        : h('p', { class: 'study-ai-muted' },
          'Accept the listed subjects, verify against your source, and resolve missing topics before creating.'),
    ]);
  },
});
