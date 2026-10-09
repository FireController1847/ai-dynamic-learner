import { computed, defineComponent, h, ref, Transition, type PropType } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { inputValue } from '../../core/dom.ts';
import { parsePuzzleAiImport, puzzleAiLimits, puzzleAiPrompt, type PuzzleAiKind, type PuzzleAiResult } from './puzzle-ai-format.ts';

export const PuzzleAiCreation = defineComponent({
  name: 'PuzzleAiCreation',
  props: {
    kind: { type: String as PropType<PuzzleAiKind>, required: true },
    destination: { type: String, required: true },
  },
  emits: { cancel: () => true, create: (_value: PuzzleAiResult) => true },
  setup(props, { emit }) {
    const label = computed(() => props.kind === 'word-search' ? 'Word Search' : 'Crossword');
    const categories = ref<AiCardCategories | null>(null);
    const scope = ref<AiCardScope | null>(null);
    const count = ref<number>(puzzleAiLimits[props.kind].initial);
    const json = ref('');
    const problem = ref('');
    const candidate = ref<PuzzleAiResult | null>(null);
    const backward = ref(false);
    const prompt = computed(() => scope.value ? puzzleAiPrompt(props.kind, scope.value, count.value) : '');
    function changeCount(event: Event) {
      const limit = puzzleAiLimits[props.kind];
      const number = Number(inputValue(event));
      if (Number.isInteger(number) && number >= limit.min && number <= limit.max) {
        count.value = number;
        candidate.value = null;
        problem.value = '';
      }
    }
    function validate() {
      candidate.value = null;
      problem.value = '';
      if (!scope.value) return;
      try { candidate.value = parsePuzzleAiImport(json.value, props.kind, scope.value, count.value); }
      catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function choose(next: AiCardScope, list: AiCardCategories) {
      scope.value = next;
      categories.value = list;
      count.value = puzzleAiLimits[props.kind].initial;
      json.value = '';
      candidate.value = null;
      problem.value = '';
      backward.value = false;
    }
    function preview() {
      const result = candidate.value;
      if (!result) return null;
      const entries = result.kind === 'word-search'
        ? result.puzzle.words.map(word => ({ key: word, answer: word, clue: result.puzzle.hints?.[word] ?? '' }))
        : result.puzzle.entries.map(entry => ({ key: entry.answer, answer: entry.answer, clue: entry.clue }));
      return h('div', [
        h('h3', result.title),
        h('p', { class: 'study-ai-muted' }, entries.length + ' ' + (result.kind === 'word-search' ? 'words with hints' : 'answers with clues') + ' · Ready to import'),
        h('ol', { class: 'puzzle-ai-preview-list' }, entries.map(entry => h('li', { key: entry.key }, [
          h('strong', entry.answer),
          h('span', entry.clue),
        ]))),
        h('button', { type: 'button', class: 'card-primary-button',
          onClick: () => { if (candidate.value) emit('create', candidate.value); },
        }, 'Create ' + (result.kind === 'word-search' ? 'word search' : 'crossword')),
      ]);
    }
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in' }, { default: () => scope.value
        ? h('section', { key: scope.value.category.key, class: 'study-ai-workspace puzzle-ai-workspace', 'data-ai-scroll-region': '' }, [
          h('header', { class: 'study-ai-header' }, [
            h('div', [
              h('p', { class: 'study-ai-muted' }, label.value + ' · Saved in ' + props.destination),
              h('h2', scope.value.category.title),
              h('p', 'Step 2 of 2 · Create one puzzle for the selected category.'),
              h('p', { class: 'study-ai-muted' }, scope.value.category.description),
            ]),
            h('div', { class: 'study-ai-actions' }, [
              h('button', { type: 'button', class: 'quiet-button', onClick: () => {
                backward.value = true; scope.value = null; json.value = ''; candidate.value = null;
              } }, 'Back to categories'),
              h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
            ]),
          ]),
          h(AiPromptExchange, {
            idPrefix: 'puzzle-' + props.kind,
            label: label.value,
            prompt: prompt.value,
            json: json.value,
            problem: problem.value,
            maxLength: MAX_AI_IMPORT_LENGTH,
            hasPreview: candidate.value !== null,
            promptHelp: 'Use the same AI conversation and original source material. This prompt builds one puzzle only for ' + scope.value.category.title + '. Copy it, send it to your AI, then import the response.',
            importHelp: 'Send the category-specific puzzle prompt to your AI, then paste its JSON response here.',
            readyInstructions: ['Paste the puzzle JSON below.', 'Validate the words and clues.', 'Review the entries, then create your puzzle.'],
            validateLabel: 'Validate puzzle',
            onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; },
            onValidate: validate,
          }, {
            options: () => h('div', { class: 'puzzle-ai-options' }, [
              h('label', { for: 'puzzle-ai-count' }, 'Target ' + (props.kind === 'word-search' ? 'words' : 'answers')),
              h('input', { id: 'puzzle-ai-count', type: 'number', min: puzzleAiLimits[props.kind].min,
                max: puzzleAiLimits[props.kind].max, step: 1, value: count.value, onChange: changeCount }),
              h('p', { class: 'study-ai-muted' }, 'Keep the puzzle focused. Fewer are fine when the source does not support the target.'),
            ]),
            preview,
          }),
        ])
        : h(AiCategoryPicker, {
          key: 'categories',
          label: label.value,
          destination: props.destination,
          initialCategories: categories.value,
          onBack: () => emit('cancel'),
          onCancel: () => emit('cancel'),
          onSelect: choose,
        }),
      }),
    ]);
  },
});
