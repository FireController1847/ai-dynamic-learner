import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { inputValue } from '../../core/dom.ts';
import { DEFAULT_AI_WEIGHTS, questionTypeLabel } from './ai-question-mix.ts';
import { parseReviewQuestionsImport, reviewAiPrompt, type ReviewAiImport } from './ai-import-format.ts';
import { MAX_QUESTIONS, questionDisplayPrompt, type Question } from './question-model.ts';

export const ReviewQuestionImport = defineComponent({
  name: 'ReviewQuestionImport',
  props: {
    setName: { type: String, required: true },
    existing: { type: Array as PropType<Question[]>, required: true },
  },
  emits: {
    back: () => true,
    append: (_questions: Question[]) => true,
  },
  setup(props, { emit }) {
    const available = computed(() => Math.max(0, MAX_QUESTIONS - props.existing.length));
    const count = ref(Math.min(20, available.value));
    const json = ref('');
    const problem = ref('');
    const candidate = ref<ReviewAiImport | null>(null);
    const prompt = computed(() => {
      if (!count.value || count.value > available.value) return '';
      const questionsToAvoid = props.existing
        .map(question => questionDisplayPrompt(question).trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      const existing = questionsToAvoid.length
        ? questionsToAvoid.map((question, index) => `${index + 1}. ${question.slice(0, 200)}`).join('\n')
        : '(No existing written questions)';
      return `I am adding questions to an EXISTING Dynamic Learner Review knowledge set named "${props.setName}". Generate ONLY new questions that complement the set, without repeating or paraphrasing the following existing questions.

Existing question prompts:
${existing}

Your answer must be a standalone valid Review JSON response with a title, description, and ONLY the additional questions. The title and description are required for the JSON format but will NOT replace my existing knowledge set name or options.

${reviewAiPrompt({
        count: count.value, mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
      }, null)}`;
    });

    function validate() {
      candidate.value = null;
      problem.value = '';
      try {
        const parsed = parseReviewQuestionsImport(json.value, count.value);
        if (parsed.questions.length > available.value) {
          throw new Error(`Only ${available.value} more ${available.value === 1 ? 'question fits' : 'questions fit'} in this set. This JSON has ${parsed.questions.length}. Reduce the import before adding.`);
        }
        candidate.value = parsed;
      } catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function previewQuestion(question: Question, index: number) {
      const answers = question.type === 'parameterized'
        ? (question.parameters?.rules.answers ?? []).map(answer => `${answer.label}: ${answer.expression ?? `Solver output ${answer.solverKey}`}`)
        : question.type === 'dropdown'
          ? (question.matches ?? []).map(row => `${row.label}: ${row.answer}`)
          : question.type === 'fill-in-the-blanks'
            ? parseFillBlankTemplate(question.prompt).answers
            : question.correctAnswers ?? (question.type === 'statement' ? [] : [question.answer]);
      return h('li', { key: question.id }, [
        h('span', { class: 'study-ai-muted' }, `${index + 1} · ${questionTypeLabel(question.type)}`),
        h('strong', questionDisplayPrompt(question)),
        question.context?.trim()
          ? h(MarkdownContent, { text: question.context, class: 'knowledge-question-context' }) : null,
        question.choices.length ? h('ul', question.choices.map(choice => h('li', choice))) : null,
        question.parameters?.rules.solver?.package
          ? h('p', { class: 'study-ai-muted' }, 'Includes a solver package for this generated question.') : null,
        question.type !== 'statement' ? h('details', [
          h('summary', 'Reveal expected answer'),
          h('p', answers.join(' · ')),
          question.explanation ? h('p', question.explanation) : null,
        ]) : null,
      ]);
    }

    return () => h('section', { class: 'knowledge-set-builder knowledge-question-import',
      'aria-label': 'Import additional questions' }, [
      h('header', { class: 'knowledge-builder-header' }, [
        h('div', [
          h('h2', 'Import questions'),
          h('p', `Append questions to ${props.setName} without replacing the existing ones.`),
        ]),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back to builder'),
      ]),
      h('p', { class: 'knowledge-muted' },
        `${props.existing.length} existing · up to ${available.value} additional questions (${MAX_QUESTIONS} maximum)`),
      h('label', { class: 'knowledge-field knowledge-question-import-count' }, [
        'Number of new questions to request',
        h('input', {
          type: 'number', min: 1, max: available.value, step: 1, value: count.value,
          onInput: (event: Event) => {
            const next = Number(inputValue(event));
            count.value = Number.isFinite(next) ? Math.max(1, Math.min(available.value, Math.trunc(next))) : 1;
            candidate.value = null;
            problem.value = '';
          },
        }),
      ]),
      h('p', { class: 'knowledge-muted' },
        'Add more questions from an AI response without replacing your existing ones.'),
      h(AiPromptExchange, {
        idPrefix: 'review-question-append', label: 'Review questions',
        prompt: prompt.value, json: json.value, problem: problem.value,
        maxLength: MAX_AI_IMPORT_LENGTH, hasPreview: candidate.value !== null,
        promptHelp: 'Copy this prompt into the AI conversation containing your source material. It requests only new questions and asks the AI to avoid repeating questions already in your set.',
        importHelp: 'Paste the AI response you want to add. Existing questions and settings stay unchanged.',
        onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; },
        onValidate: validate,
      }, {
        preview: () => candidate.value ? h('div', { class: 'study-ai-preview' }, [
          h('h3', `${candidate.value.questions.length} new questions ready`),
          h('p', { class: 'knowledge-muted' },
            'Only questions are added. Imported titles and descriptions are ignored. Nothing is saved until you save the builder.'),
          candidate.value.warnings.length ? h('section', { class: 'review-ai-import-warning',
            role: 'status', 'aria-label': 'Import warnings' }, [
            h('strong', 'Review these warnings'),
            h('ul', candidate.value.warnings.map(warning => h('li', warning))),
          ]) : null,
          h('ol', { class: 'review-ai-preview' }, candidate.value.questions.map(previewQuestion)),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => {
            if (candidate.value) emit('append', candidate.value.questions);
          } }, `Add ${candidate.value.questions.length} ${candidate.value.questions.length === 1 ? 'question' : 'questions'} to builder`),
        ]) : null,
      }),
    ]);
  },
});
