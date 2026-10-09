import { computed, defineComponent, h, ref, Transition, type PropType } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { inputValue } from '../../core/dom.ts';
import { DIFFICULTIES, GRID_SIZES, MAX_INSTRUCTIONS_LENGTH, STUDY_MODES, type Difficulty, type GridSize, type StudyMode } from '../word-search/puzzle-model.ts';
import { defaultPuzzleAiOptions, parsePuzzleAiImport, puzzleAiLimits, puzzleAiPrompt, type PuzzleAiKind, type PuzzleAiOptions, type PuzzleAiResult } from './puzzle-ai-format.ts';

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
    const preferences = ref<PuzzleAiOptions>(defaultPuzzleAiOptions(props.kind));
    const configured = ref(false);
    const configurationProblem = ref('');
    const json = ref('');
    const problem = ref('');
    const candidate = ref<PuzzleAiResult | null>(null);
    const backward = ref(false);
    const prompt = computed(() => scope.value ? puzzleAiPrompt(props.kind, scope.value, preferences.value) : '');
    function updatePreferences(changes: Partial<PuzzleAiOptions>) {
      preferences.value = { ...preferences.value, ...changes };
      candidate.value = null;
      problem.value = '';
      configurationProblem.value = '';
    }
    function continueToPrompt(event: Event) {
      event.preventDefault();
      const { count, instructions } = preferences.value;
      const bounds = puzzleAiLimits[props.kind];
      if (!Number.isInteger(count) || count < bounds.min || count > bounds.max) {
        configurationProblem.value = `Choose between ${bounds.min} and ${bounds.max} ${props.kind === 'word-search' ? 'words' : 'answers'}.`;
        return;
      }
      if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
        configurationProblem.value = `Instructions must contain at most ${MAX_INSTRUCTIONS_LENGTH} characters.`;
        return;
      }
      json.value = '';
      candidate.value = null;
      problem.value = '';
      configurationProblem.value = '';
      backward.value = false;
      configured.value = true;
    }
    function validate() {
      candidate.value = null;
      problem.value = '';
      if (!scope.value) return;
      try { candidate.value = parsePuzzleAiImport(json.value, props.kind, scope.value, preferences.value); }
      catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function choose(next: AiCardScope, list: AiCardCategories) {
      scope.value = next;
      categories.value = list;
      preferences.value = defaultPuzzleAiOptions(props.kind);
      configured.value = false;
      configurationProblem.value = '';
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
        h('p', { class: 'study-ai-muted' }, entries.length + ' ' + (result.kind === 'word-search'
          ? result.puzzle.studyMode === 'hints' ? 'words with hints' : 'words to find'
          : 'answers with clues') + ' · Ready to import'),
        h('ol', { class: 'puzzle-ai-preview-list' }, entries.map(entry => h('li', { key: entry.key }, [
          h('strong', entry.answer),
          entry.clue ? h('span', entry.clue) : null,
        ]))),
        h('button', { type: 'button', class: 'card-primary-button',
          onClick: () => { if (candidate.value) emit('create', candidate.value); },
        }, 'Create ' + (result.kind === 'word-search' ? 'word search' : 'crossword')),
      ]);
    }
    function settings() {
      const wordSearch = props.kind === 'word-search';
      const bounds = puzzleAiLimits[props.kind];
      const current = preferences.value;
      return h('section', { key: 'configure', class: 'study-ai-workspace puzzle-ai-workspace' }, [
        h('header', { class: 'study-ai-header' }, [
          h('div', [
            h('p', { class: 'study-ai-muted' }, label.value + ' · Saved in ' + props.destination),
            h('h2', 'Configure ' + (wordSearch ? 'word search' : 'crossword')),
            h('p', 'Step 2 of 3 · Choose your puzzle options before generating the AI prompt.'),
            h('p', { class: 'study-ai-muted' }, scope.value?.category.title ?? ''),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              backward.value = true; scope.value = null; configured.value = false;
            } }, 'Back to categories'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
          ]),
        ]),
        h('form', { class: 'puzzle-ai-setup', onSubmit: continueToPrompt }, [
          h('div', { class: 'puzzle-ai-setup-grid' }, [
            h('label', { class: 'puzzle-ai-setting' }, [
              h('span', wordSearch ? 'Target words' : 'Target answers'),
              h('input', {
                type: 'number', required: true, min: bounds.min, max: bounds.max, step: 1,
                value: current.count,
                onInput: (event: Event) => updatePreferences({ count: Number(inputValue(event)) }),
              }),
              h('span', { class: 'study-ai-muted' },
                `Choose ${bounds.min}–${bounds.max}. Use fewer when the category is small.`),
            ]),
            wordSearch ? h('label', { class: 'puzzle-ai-setting' }, [
              h('span', 'Grid size'),
              h('select', {
                value: current.size,
                onChange: (event: Event) =>
                  updatePreferences({ size: Number(inputValue(event)) as GridSize }),
              }, GRID_SIZES.map(size => h('option', { value: size }, `${size} × ${size}`))),
              h('span', { class: 'study-ai-muted' },
                'The AI must choose words short enough for this grid. Very dense word lists may not fit.'),
            ]) : h('div', { class: 'puzzle-ai-setting' }, [
              h('span', 'Grid size'),
              h('strong', 'Automatic'),
              h('span', { class: 'study-ai-muted' },
                'Crossword determines the grid from the intersections of its answers.'),
            ]),
          ]),
          h('fieldset', { class: 'puzzle-ai-choice-group' }, [
            h('legend', wordSearch ? 'Difficulty' : 'Clue difficulty'),
            ...DIFFICULTIES.map(choice => {
              const selected = wordSearch
                ? current.difficulty === choice.value : current.clueDifficulty === choice.value;
              const description = wordSearch ? choice.description
                : choice.value === 'easy' ? 'Clear, straightforward definitions.'
                : choice.value === 'medium' ? 'Balanced clues that reward recall.'
                : 'Indirect but fair and answerable clues.';
              return h('label', {
                key: choice.value, class: ['puzzle-ai-choice', { 'is-selected': selected }],
              }, [
                h('input', {
                  type: 'radio',
                  name: 'puzzle-ai-difficulty',
                  value: choice.value,
                  checked: selected,
                  onChange: () => wordSearch
                    ? updatePreferences({ difficulty: choice.value as Difficulty })
                    : updatePreferences({ clueDifficulty: choice.value as Difficulty }),
                }),
                h('span', [
                  h('strong', choice.label),
                  h('span', { class: 'study-ai-muted' }, description),
                ]),
              ]);
            }),
          ]),
          !wordSearch ? h('p', { class: 'study-ai-muted' },
            'Clue difficulty influences AI wording only; Crossword generates the actual grid automatically.') : null,
          wordSearch ? h('fieldset', { class: 'puzzle-ai-choice-group' }, [
            h('legend', 'Study display'),
            ...STUDY_MODES.map(choice => h('label', {
              key: choice.value,
              class: ['puzzle-ai-choice', { 'is-selected': current.studyMode === choice.value }],
            }, [
              h('input', {
                type: 'radio', name: 'puzzle-ai-display', value: choice.value,
                checked: current.studyMode === choice.value,
                onChange: () => updatePreferences({ studyMode: choice.value as StudyMode }),
              }),
              h('span', [
                h('strong', choice.label),
                h('span', { class: 'study-ai-muted' }, choice.description),
              ]),
            ])),
          ]) : null,
          h('label', { class: 'puzzle-ai-setting' }, [
            h('span', 'Instructions (optional)'),
            h('textarea', {
              rows: 3, maxlength: MAX_INSTRUCTIONS_LENGTH,
              value: current.instructions,
              placeholder: wordSearch ? 'e.g. Find the key vocabulary from this topic.'
                : 'e.g. Complete this topic using the clues.',
              onInput: (event: Event) => updatePreferences({ instructions: inputValue(event) }),
            }),
            h('span', { class: 'study-ai-muted' },
              'These instructions are saved with the puzzle; they are not generated by AI.'),
          ]),
          configurationProblem.value ? h('p', { role: 'alert', class: 'ai-exchange-error' }, configurationProblem.value) : null,
          h('div', { class: 'study-ai-actions' }, [
            h('button', { type: 'submit', class: 'card-primary-button' }, 'Continue to AI prompt →'),
          ]),
        ]),
      ]);
    }
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in' }, { default: () => scope.value
        ? !configured.value ? settings()
        : h('section', { key: 'generate-' + scope.value.category.key, class: 'study-ai-workspace puzzle-ai-workspace', 'data-ai-scroll-region': '' }, [
          h('header', { class: 'study-ai-header' }, [
            h('div', [
              h('p', { class: 'study-ai-muted' }, label.value + ' · Saved in ' + props.destination),
              h('h2', scope.value.category.title),
              h('p', 'Step 3 of 3 · Create one puzzle using your selected settings.'),
              h('p', { class: 'study-ai-muted' }, scope.value.category.description),
            ]),
            h('div', { class: 'study-ai-actions' }, [
              h('button', { type: 'button', class: 'quiet-button', onClick: () => {
                backward.value = true; configured.value = false; json.value = ''; candidate.value = null;
              } }, 'Edit settings'),
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
            readyInstructions: ['Paste the puzzle JSON below.', 'Validate the generated terms and any hints or clues.', 'Review the entries, then create your puzzle.'],
            validateLabel: 'Validate puzzle',
            onUpdateJson: (value: string) => { json.value = value; candidate.value = null; problem.value = ''; },
            onValidate: validate,
          }, {
            guidance: () => h('p', { class: 'study-ai-muted' },
              props.kind === 'word-search'
                ? `${preferences.value.size} × ${preferences.value.size} · ${preferences.value.difficulty} · ${preferences.value.studyMode === 'hints' ? 'Hints' : 'Word list'} · Up to ${preferences.value.count} words`
                : `Automatic grid · ${preferences.value.clueDifficulty} clues · Up to ${preferences.value.count} answers`),
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
