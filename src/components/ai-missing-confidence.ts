import { defineComponent, h, ref, type PropType } from 'vue';
import { aiConfidenceRequest } from '../core/ai-confidence-repair.ts';

/** Missing estimates remain explicit; repair yields a full replaceable JSON file. */
export const AiMissingConfidence = defineComponent({
  name: 'AiMissingConfidence',
  props: {
    app: { type: String as PropType<'Review' | 'Guide'>, required: true },
    items: { type: Array as PropType<readonly string[]>, required: true },
  },
  emits: { retry: () => true },
  setup(props, { emit }) {
    const status = ref('');
    const fallback = ref(false);
    const prompt = () => aiConfidenceRequest(props.app, props.items);
    async function copy() {
      try {
        await navigator.clipboard.writeText(prompt());
        status.value = 'Request copied. Send it in the same AI conversation, then upload the complete corrected JSON file.';
        fallback.value = false;
      } catch {
        status.value = 'Automatic copying was blocked. Copy the instructions below into the same AI chat.';
        fallback.value = true;
      }
    }
    return () => h('section', { class: 'ai-missing-confidence', 'aria-label': 'Confidence estimates unavailable' }, [
      h('strong', 'Confidence estimates unavailable'),
      h('p', { role: 'alert' },
        'The AI did not supply usable confidence statistics, so the graphs cannot be shown yet. Dynamic Learner has not guessed these values.'),
      h('div', { class: 'ai-missing-confidence-values' },
        ['Overall coverage', 'Exam confidence', 'Subject confidence', 'Study confidence']
          .map(label => h('div', { key: label }, [h('span', label), h('strong', 'Not determined')]))),
      h('p', 'Request a corrected full JSON file with confidence estimates. Your valid study content should remain unchanged.'),
      h('div', { class: 'study-ai-actions' }, [
        h('button', { type: 'button', class: 'card-primary-button', onClick: () => { void copy(); } },
          'Copy full-file confidence request'),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('retry') },
          'Return to JSON upload'),
      ]),
      status.value ? h('p', { role: 'status' }, status.value) : null,
      fallback.value ? h('textarea', {
        readonly: true, rows: 6, value: prompt(), 'aria-label': 'Full-file confidence correction request',
      }) : null,
      h('p', { class: 'study-ai-muted' }, 'Estimates come from the external AI, not a verified calculation.'),
    ]);
  },
});
