import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { DEFAULT_AI_WEIGHTS, questionCountProblem } from './ai-question-mix.ts';
import { reviewAiPrompt, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { ReviewAiResponseWorkspace } from './ai-response-workspace.ts';
import { questionDisplayPrompt, type Question } from './question-model.ts';

export const ReviewQuestionImport = defineComponent({
  name: 'ReviewQuestionImport',
  props: {
    setName: { type: String, required: true },
    existing: { type: Array as PropType<Question[]>, required: true },
  },
  emits: { back: () => true, append: (_questions: Question[]) => true },
  setup(props, { emit }) {
    const count = ref(20);
    const preferences = computed<ReviewAiPreferences>(() => ({
      count: count.value, mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
    }));
    function promptForCount(requested: number) {
      if (questionCountProblem(requested)) return '';
      const questions = props.existing.map(question => questionDisplayPrompt(question).trim().replace(/\s+/g, ' '))
        .filter(Boolean).map((question, index) => (index + 1) + '. ' + question.slice(0, 200)).join('\n');
      return 'I am adding questions to an existing Dynamic Learner Review knowledge set named ' + JSON.stringify(props.setName) +
        '. Generate only new questions from the original study material; do not repeat or paraphrase these existing questions:\n' +
        (questions || '(No existing written questions)') + '\n\nUse the study material attached to this message or already supplied in this conversation. ' +
        'If no study material is available, ask for it before generating questions. Only the additional questions will be imported.\n\n' +
        reviewAiPrompt({ ...preferences.value, count: requested }, null).replace('original source material supplied earlier in this conversation',
          'original source material attached to this message or supplied earlier in this conversation');
    }
    const prompt = computed(() => promptForCount(count.value));
    return () => h('section', { class: 'knowledge-set-builder knowledge-question-import review-ai-workspace', 'aria-label': 'Import additional questions' }, [
      h('header', { class: 'knowledge-builder-header' }, [
        h('div', [
          h('h2', 'Add questions with AI'),
          h('p', props.setName + ' · ' + props.existing.length + ' existing questions'),
        ]),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back to builder'),
      ]),
      h('section', { class: 'review-ai-panel' }, [
        h('label', { class: 'knowledge-field knowledge-question-import-count' }, [
          'Number of new questions',
          h('input', { type: 'number', min: 1, step: 1, value: count.value,
            onInput: (event: Event) => { count.value = Number(inputValue(event)); } }),
        ]),
        h('p', { class: 'study-ai-muted' }, 'Your existing questions and settings stay unchanged. Nothing is saved until you save the builder.'),
        questionCountProblem(count.value) ? h('p', { class: 'study-ai-error' }, questionCountProblem(count.value)) : null,
      ]),
      h(ReviewAiResponseWorkspace, {
        preferences: preferences.value, prompt: prompt.value, promptForCount, appendMode: true, existing: props.existing,
        onComplete: (value: ReviewAiImport) => emit('append', value.questions),
      }),
    ]);
  },
});
