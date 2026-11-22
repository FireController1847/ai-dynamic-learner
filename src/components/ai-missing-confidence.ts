import { defineComponent, h, ref, type PropType } from 'vue';
import { inputValue } from '../core/dom.ts';
import { aiConfidenceRequest, parseAiConfidenceReply, type AiConfidenceValues } from '../core/ai-confidence-repair.ts';

/** Visible missing-data summary and confidence-only repair flow. */
export const AiMissingConfidence = defineComponent({
  name: 'AiMissingConfidence',
  props: {
    app: { type: String as PropType<'Review' | 'Guide'>, required: true },
    items: { type: Array as PropType<readonly string[]>, required: true },
  },
  emits: { apply: (_values: AiConfidenceValues) => true },
  setup(props, { emit }) {
    const response = ref('');
    const status = ref('');
    const error = ref('');
    const fallback = ref(false);
    const prompt = () => aiConfidenceRequest(props.app, props.items);
    async function copy() {
      error.value = '';
      try {
        await navigator.clipboard.writeText(prompt());
        status.value = 'Request copied. Send it to the same AI chat, then paste the confidence JSON below.';
        fallback.value = false;
      } catch {
        status.value = 'Copying was blocked. Copy the request below into your AI chat.';
        fallback.value = true;
      }
    }
    function apply() {
      error.value = '';
      try { emit('apply', parseAiConfidenceReply(response.value)); }
      catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Could not read the AI confidence values.';
      }
    }
    return () => h('section', { class: 'ai-missing-confidence', 'aria-label': 'Confidence estimates unavailable' }, [
      h('strong', 'Confidence estimates unavailable'),
      h('p', { role: 'alert' },
        'The AI did not supply usable confidence statistics, so the graphs cannot be shown yet. Dynamic Learner has not guessed these values.'),
      h('div', { class: 'ai-missing-confidence-values' },
        ['Overall coverage', 'Exam confidence', 'Subject confidence', 'Study confidence']
          .map(label => h('div', { key: label }, [h('span', label), h('strong', 'Not determined')]))),
      h('p', 'Request only the missing statistics without regenerating your study content.'),
      h('div', { class: 'study-ai-actions' }, [
        h('button', { type: 'button', class: 'card-primary-button', onClick: () => { void copy(); } },
          'Copy request to generate confidence'),
      ]),
      status.value ? h('p', { role: 'status' }, status.value) : null,
      fallback.value ? h('textarea', {
        readonly: true, rows: 6, value: prompt(), 'aria-label': 'Confidence generation request',
      }) : null,
      h('label', { class: 'ai-missing-confidence-input' }, [
        h('span', 'Paste confidence JSON from the same AI chat'),
        h('textarea', {
          rows: 5, value: response.value, placeholder: 'Paste the seven-field confidence JSON object here.',
          onInput: (event: Event) => { response.value = inputValue(event); error.value = ''; },
        }),
      ]),
      h('div', { class: 'study-ai-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', disabled: !response.value.trim(), onClick: apply },
          'Show confidence graphs'),
      ]),
      error.value ? h('p', { role: 'alert', class: 'ai-exchange-error' }, error.value) : null,
      h('p', { class: 'study-ai-muted' }, 'Estimates come from the external AI, not a verified calculation.'),
    ]);
  },
});
