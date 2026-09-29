import { Icon } from '../../components/icon.js';
import { MAX_NAME_LENGTH } from './library-model.js';
import {
  DIFFICULTIES, GRID_SIZES, MAX_HINT_LENGTH, MAX_INSTRUCTIONS_LENGTH, MAX_WORD_INPUT_LENGTH,
  MAX_WORDS, MIN_WORDS, STUDY_MODES, parseWords, validatePuzzle,
} from './puzzle-model.ts';

import { computed, h, nextTick, onMounted, ref } from 'vue';

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
    const studyMode = ref(props.item?.puzzle?.studyMode ?? 'words');
    const hints = ref({ ...(props.item?.puzzle?.hints ?? {}) });
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
        const savedHints = Object.fromEntries(parsed.value.words
          .filter((word) => hints.value[word]?.trim())
          .map((word) => [word, hints.value[word].trim()]));
        const puzzle = {
          words: [...parsed.value.words], size: size.value,
          difficulty: difficulty.value, instructions: instructions.value.trim(),
          studyMode: studyMode.value, hints: savedHints,
        };
        validatePuzzle(puzzle);
        props.save(name.value, puzzle);
      } catch (problem) {
        error.value = problem.message;
        await nextTick();
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
      h('fieldset', { class: 'word-search-study-mode' }, [
        h('legend', 'Study display'),
        h('p', { class: 'word-search-help' }, 'Choose whether the play sidebar gives away the answers or presents clue-style hints.'),
        ...STUDY_MODES.map((choice) => h('label', {
          class: ['word-search-study-choice', { 'is-selected': studyMode.value === choice.value }],
        }, [
          h('input', {
            type: 'radio', name: 'puzzle-study-mode', value: choice.value,
            checked: studyMode.value === choice.value,
            onChange: () => { studyMode.value = choice.value; },
          }),
          h('span', [h('strong', choice.label), h('span', { class: 'word-search-help' }, choice.description)]),
        ])),
      ]),
      studyMode.value === 'hints' && parsed.value.words.length ? h('section', {
        class: 'word-search-hint-editor', 'aria-labelledby': 'word-search-hint-heading',
      }, [
        h('h3', { id: 'word-search-hint-heading' }, 'Hints'),
        h('p', { class: 'word-search-help' }, 'Write a clue for each answer. Players can reveal an individual answer without marking it found.'),
        h('div', { class: 'word-search-hint-fields' }, parsed.value.words.map((word) => h('label', {
          key: word, class: 'word-search-hint-field',
        }, [
          h('span', word),
          h('textarea', {
            rows: 2, required: true, maxlength: MAX_HINT_LENGTH,
            placeholder: 'Describe this answer without naming it directly.',
            value: hints.value[word] ?? '',
            onInput: (event) => { hints.value[word] = event.target.value; },
          }),
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
        ? 'Changing words, grid size, or difficulty starts a new puzzle and clears found words. Title, instructions, study display, and hints keep the existing grid and progress.'
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
          `${puzzle.words.length} words · ${puzzle.size} × ${puzzle.size} grid · ${DIFFICULTIES.find(({ value }) => value === puzzle.difficulty).label} · ${(puzzle.studyMode ?? 'words') === 'hints' ? 'Hint study mode' : 'Word-list study mode'}`) : null,
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
