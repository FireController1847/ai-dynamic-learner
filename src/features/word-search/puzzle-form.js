import { Icon } from '../../components/icon.js';
import { MAX_NAME_LENGTH } from './library-model.js';
import {
  DIFFICULTIES, GRID_SIZES, MAX_INSTRUCTIONS_LENGTH, MAX_WORD_INPUT_LENGTH,
  MAX_WORDS, MIN_WORDS, parseWords, validatePuzzle,
} from './puzzle-model.js';

const { computed, h, onMounted, ref } = window.Vue;

export const PuzzleForm = {
  name: 'PuzzleForm',
  props: {
    item: { type: Object, default: null },
    destination: { type: String, required: true },
    save: { type: Function, required: true },
  },
  emits: ['cancel'],
  setup(props, { emit }) {
    const name = ref(props.item?.name ?? '');
    const wordsText = ref(props.item?.puzzle?.words.join('\n') ?? '');
    const size = ref(props.item?.puzzle?.size ?? 15);
    const difficulty = ref(props.item?.puzzle?.difficulty ?? 'medium');
    const instructions = ref(props.item?.puzzle?.instructions ?? '');
    const error = ref('');
    const titleInput = ref(null);
    const errorBox = ref(null);
    const parsed = computed(() => parseWords(wordsText.value));
    onMounted(() => titleInput.value?.focus());

    async function submit(event) {
      event.preventDefault();
      error.value = '';
      try {
        if (!name.value.trim()) throw new Error('Give your word search a title.');
        if (parsed.value.error) throw new Error(parsed.value.error);
        const puzzle = {
          words: [...parsed.value.words], size: size.value,
          difficulty: difficulty.value, instructions: instructions.value.trim(),
        };
        validatePuzzle(puzzle);
        props.save(name.value, puzzle);
      } catch (problem) {
        error.value = problem.message;
        await window.Vue.nextTick();
        errorBox.value?.focus();
      }
    }

    return () => h('form', { class: 'word-search-form', onSubmit: submit }, [
      h('header', { class: 'word-search-form-intro' }, [
        h('p', { class: 'word-search-eyebrow' }, props.item ? 'Puzzle settings' : 'Make it your own'),
        h('h2', props.item ? 'Edit word search' : 'New word search'),
        h('p', `Saved in ${props.destination}. Add your words and choose how challenging the puzzle should be.`),
      ]),
      h('div', { class: 'word-search-field' }, [
        h('label', { for: 'puzzle-title' }, 'Title'),
        h('input', {
          ref: titleInput, id: 'puzzle-title', required: true, maxlength: MAX_NAME_LENGTH,
          placeholder: 'e.g. A walk in the woods', value: name.value,
          onInput: (event) => { name.value = event.target.value; },
        }),
      ]),
      h('div', { class: 'word-search-form-columns' }, [
        h('div', { class: 'word-search-field' }, [
          h('label', { for: 'puzzle-words' }, 'Words to find'),
          h('p', { id: 'puzzle-words-help', class: 'word-search-help' },
            `Add ${MIN_WORDS}–${MAX_WORDS} words, one per line or separated by commas. English letters A–Z; spaces, hyphens, and apostrophes are removed.`),
          h('textarea', {
            id: 'puzzle-words', rows: 10, required: true, maxlength: MAX_WORD_INPUT_LENGTH,
            placeholder: 'FOREST\nRIVER\nWILLOW', value: wordsText.value, spellcheck: false,
            'aria-describedby': 'puzzle-words-help puzzle-word-count',
            onInput: (event) => { wordsText.value = event.target.value; },
          }),
          h('p', { id: 'puzzle-word-count', class: 'word-search-help', role: 'status' },
            `${parsed.value.words.length} / ${MAX_WORDS} unique words${parsed.value.duplicates ? ` · ${parsed.value.duplicates} duplicate entries combined` : ''}`),
          parsed.value.error ? h('p', { class: 'word-search-error' }, parsed.value.error) : null,
        ]),
        h('div', { class: 'word-search-options' }, [
          h('div', { class: 'word-search-field' }, [
            h('label', { for: 'puzzle-size' }, 'Grid size'),
            h('select', {
              id: 'puzzle-size', value: size.value,
              onChange: (event) => { size.value = Number(event.target.value); },
            }, GRID_SIZES.map((value) => h('option', { value }, `${value} × ${value}`))),
            h('p', { class: 'word-search-help' }, 'Choose a grid at least as wide as your longest word.'),
          ]),
          h('fieldset', { class: 'word-search-difficulty' }, [
            h('legend', 'Difficulty'),
            ...DIFFICULTIES.map((choice) => h('label', {
              class: ['word-search-difficulty-choice', { 'is-selected': difficulty.value === choice.value }],
            }, [
              h('input', {
                type: 'radio', name: 'puzzle-difficulty', value: choice.value,
                checked: difficulty.value === choice.value,
                onChange: () => { difficulty.value = choice.value; },
              }),
              h('span', [h('strong', choice.label), h('span', { class: 'word-search-help' }, choice.description)]),
            ])),
          ]),
        ]),
      ]),
      parsed.value.words.length ? h('div', { class: 'word-search-word-preview' }, [
        h('h3', 'Word list preview'),
        h('ul', { class: 'word-search-word-chips' }, parsed.value.words.map((word) =>
          h('li', { key: word, class: { 'is-too-long': word.length > size.value } }, [
            word, word.length > size.value ? h('span', ' · too long for this grid') : null,
          ]))),
      ]) : null,
      h('div', { class: 'word-search-field' }, [
        h('label', { for: 'puzzle-instructions' }, 'Instructions (optional)'),
        h('textarea', {
          id: 'puzzle-instructions', rows: 2, maxlength: MAX_INSTRUCTIONS_LENGTH,
          placeholder: 'e.g. Find the words you might spot on a nature walk.', value: instructions.value,
          onInput: (event) => { instructions.value = event.target.value; },
        }),
      ]),
      error.value ? h('p', {
        ref: errorBox, class: 'word-search-error', role: 'alert', tabindex: -1,
      }, error.value) : null,
      h('p', { class: 'word-search-help' }, props.item?.game
        ? 'Changing words, grid size, or difficulty starts a new puzzle and clears found words. Title and instruction edits keep your progress.'
        : 'Your puzzle will be generated after saving. If the words cannot fit, try a larger grid or fewer words.'),
      h('div', { class: 'word-search-form-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        h('button', { type: 'submit', class: 'card-primary-button' }, [
          h(Icon, { name: props.item ? 'pencil' : 'plus' }), props.item ? 'Save changes' : 'Create word search',
        ]),
      ]),
    ]);
  },
};

export const PuzzleSummary = {
  name: 'PuzzleSummary',
  props: { item: { type: Object, required: true } },
  emits: ['edit'],
  setup(props, { emit }) {
    return () => {
      const puzzle = props.item.puzzle;
      return h('div', { class: 'word-search-puzzle-summary' }, [
        h('h3', puzzle ? 'Puzzle setup' : 'Add your puzzle details'),
        puzzle ? h('p', { class: 'word-search-help' },
          `${puzzle.words.length} words · ${puzzle.size} × ${puzzle.size} grid · ${DIFFICULTIES.find(({ value }) => value === puzzle.difficulty).label}`) : null,
        puzzle?.instructions ? h('p', { class: 'word-search-instructions' }, puzzle.instructions) : null,
        puzzle ? h('ul', { class: 'word-search-word-chips' }, puzzle.words.map((word) => h('li', { key: word }, word))) : null,
        h('p', { class: 'word-search-help' }, puzzle
          ? 'Your word list and settings are saved.'
          : 'Choose words and settings to complete this word search.'),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') },
          puzzle ? 'Edit word search' : 'Set up word search'),
      ]);
    };
  },
};
