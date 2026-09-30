import type { CrosswordItem } from './library-model.ts';
import type { Puzzle } from './puzzle-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import {
  MAX_ANSWER_INPUT_LENGTH, MAX_CLUE_LENGTH, MAX_ENTRIES,
  MAX_INSTRUCTIONS_LENGTH, MIN_ENTRIES, parseAnswers, validatePuzzleForGeneration,
} from './puzzle-model.ts';

import { defineComponent, type PropType, computed, h, nextTick, onMounted, ref } from 'vue';

export const PuzzleForm = defineComponent({
  name: 'CrosswordPuzzleForm',
  props: {
    item: { type: Object as PropType<CrosswordItem>, default: null },
    destination: { type: String, required: true },
    save: { type: Function as PropType<(name: string, puzzle: Puzzle) => void>, required: true },
  },
  emits: { 'cancel': () => true },
  setup(props, { emit }) {
    const name = ref(props.item?.name ?? '');
    const answersText = ref(props.item?.puzzle?.entries.map(({ answer }) => answer).join('\n') ?? '');
    const instructions = ref(props.item?.puzzle?.instructions ?? '');
    const clues = ref(Object.fromEntries(props.item?.puzzle?.entries.map(({ answer, clue }) => [answer, clue]) ?? []));
    const error = ref('');
    const titleInput = ref<HTMLInputElement | null>(null);
    const errorBox = ref<HTMLElement | null>(null);
    const parsed = computed(() => parseAnswers(answersText.value));

    onMounted(() => titleInput.value?.focus());

    async function submit(event: Event) {
      event.preventDefault();
      error.value = '';
      try {
        if (!name.value.trim()) throw new Error('Give your crossword a title.');
        if (parsed.value.errors.length) throw new Error(parsed.value.errors.join(' '));

        const puzzle: Puzzle = {
          entries: parsed.value.answers.map((answer) => ({
            answer,
            clue: clues.value[answer]?.trim() ?? '',
          })),
          instructions: instructions.value.trim(),
        };
        validatePuzzleForGeneration(puzzle);
        props.save(name.value, puzzle);
      } catch (problem) {
        error.value = problem instanceof Error ? problem.message : String(problem);
        await nextTick();
        errorBox.value?.focus();
      }
    }

    return () => h('form', { class: 'crossword-form', onSubmit: submit }, [
      h('header', { class: 'crossword-form-intro' }, [
        h('p', { class: 'crossword-eyebrow' }, props.item ? 'Puzzle settings' : 'Make it your own'),
        h('h2', props.item ? 'Edit crossword' : 'New crossword'),
        h('p', `Saved in ${props.destination}. Add answers and clues; the crossword builds its own grid from the ways your answers can intersect.`),
      ]),
      h('div', { class: 'crossword-field' }, [
        h('label', { for: 'crossword-title' }, 'Title'),
        h('input', {
          ref: titleInput,
          id: 'crossword-title',
          required: true,
          maxlength: MAX_NAME_LENGTH,
          placeholder: 'e.g. Computer science review',
          value: name.value,
          onInput: (event: Event) => { name.value = inputValue(event); },
        }),
      ]),
      h('div', { class: 'crossword-form-columns' }, [
        h('div', { class: 'crossword-field' }, [
          h('label', { for: 'crossword-answers' }, 'Answers'),
          h('p', { id: 'crossword-answers-help', class: 'crossword-help' },
            `Add ${MIN_ENTRIES}–${MAX_ENTRIES} answers, one per line or separated by commas. Every answer must connect to the same crossword through shared letters.`),
          h('textarea', {
            id: 'crossword-answers',
            rows: 10,
            required: true,
            maxlength: MAX_ANSWER_INPUT_LENGTH,
            placeholder: 'ALGORITHM\nCOMPILER\nBINARY',
            value: answersText.value,
            spellcheck: false,
            'aria-describedby': 'crossword-answers-help crossword-answer-count crossword-answer-validation',
            onInput: (event: Event) => {
              answersText.value = inputValue(event);
              error.value = '';
            },
          }),
          h('p', { id: 'crossword-answer-count', class: 'crossword-help', role: 'status' },
            `${parsed.value.answers.length} / ${MAX_ENTRIES} unique answers${parsed.value.duplicates ? ` · ${parsed.value.duplicates} duplicate ${parsed.value.duplicates === 1 ? 'entry' : 'entries'} combined` : ''}`),
          h('div', {
            id: 'crossword-answer-validation',
            class: ['crossword-answer-validation', { 'is-ready': !parsed.value.errors.length && parsed.value.answers.length >= MIN_ENTRIES }],
            role: 'status',
          }, parsed.value.errors.length
            ? [
              h('strong', 'Fix these before creating the crossword:'),
              h('ul', parsed.value.errors.map((issue) => h('li', { key: issue }, issue))),
            ]
            : parsed.value.answers.length
              ? [h('span', `✓ These ${parsed.value.answers.length} answers can connect into one crossword. The grid size will be chosen automatically.`)]
              : [h('span', 'Enter your answers to check whether they can connect.')]),
        ]),
        parsed.value.answers.length ? h('div', { class: 'crossword-options' }, [
          h('div', { class: 'crossword-answer-preview' }, [
            h('h3', 'Answer preview'),
            h('p', { class: 'crossword-help' },
              'This is the normalized answer text that will appear in the grid. Spaces and common punctuation are removed.'),
            h('ul', { class: 'crossword-answer-chips' }, parsed.value.answers.map((answer) =>
              h('li', { key: answer }, answer))),
          ]),
        ]) : null,
      ]),
      parsed.value.answers.length ? h('section', {
        class: 'crossword-clue-editor',
        'aria-labelledby': 'crossword-clue-heading',
      }, [
        h('h3', { id: 'crossword-clue-heading' }, 'Clues'),
        h('p', { class: 'crossword-help' },
          'Write one clue for each answer. Across/Down placement and clue numbering are assigned automatically when the crossword is generated.'),
        h('div', { class: 'crossword-clue-fields' }, parsed.value.answers.map((answer) => h('label', {
          key: answer,
          class: 'crossword-clue-field',
        }, [
          h('span', answer),
          h('textarea', {
            rows: 2,
            required: true,
            maxlength: MAX_CLUE_LENGTH,
            placeholder: 'Write a clue without giving away the answer.',
            value: clues.value[answer] ?? '',
            onInput: (event: Event) => { clues.value[answer] = inputValue(event); },
          }),
        ]))),
      ]) : null,
      h('div', { class: 'crossword-field' }, [
        h('label', { for: 'crossword-instructions' }, 'Instructions (optional)'),
        h('textarea', {
          id: 'crossword-instructions',
          rows: 2,
          maxlength: MAX_INSTRUCTIONS_LENGTH,
          placeholder: 'e.g. Review the vocabulary from this unit.',
          value: instructions.value,
          onInput: (event: Event) => { instructions.value = inputValue(event); },
        }),
      ]),
      error.value ? h('p', {
        ref: errorBox,
        class: 'crossword-error',
        role: 'alert',
        tabindex: -1,
      }, error.value) : null,
      h('p', { class: 'crossword-help' }, props.item?.game
        ? 'Changing the answers creates a new layout and clears typed letters. Title, clues, and instructions keep the current layout and progress.'
        : 'The generator chooses the grid automatically from the answer lengths and intersections. If your answers cannot form one connected crossword, the form will tell you which ones need attention.'),
      h('div', { class: 'crossword-form-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        h('button', {
          type: 'submit',
          class: 'card-primary-button',
          disabled: parsed.value.errors.length > 0,
        }, [
          h(Icon, { name: props.item ? 'pencil' : 'plus' }),
          props.item ? 'Save changes' : 'Create crossword',
        ]),
      ]),
    ]);
  },
});

export const PuzzleSummary = defineComponent({
  name: 'CrosswordPuzzleSummary',
  props: { item: { type: Object as PropType<CrosswordItem>, required: true } },
  emits: { 'edit': () => true },
  setup(props, { emit }) {
    return () => {
      const puzzle = props.item.puzzle;
      const generatedSize = props.item.game?.rows.length;
      return h('div', { class: 'crossword-puzzle-summary' }, [
        h('h3', puzzle ? 'Puzzle setup' : 'Add your puzzle details'),
        puzzle ? h('p', { class: 'crossword-help' },
          generatedSize
            ? `${puzzle.entries.length} answers · generated ${generatedSize} × ${generatedSize} grid`
            : `${puzzle.entries.length} answers · automatic grid`) : null,
        puzzle?.instructions ? h('p', { class: 'crossword-instructions' }, puzzle.instructions) : null,
        puzzle ? h('ul', { class: 'crossword-answer-chips' },
          puzzle.entries.map(({ answer }) => h('li', { key: answer }, answer))) : null,
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') },
          puzzle ? 'Edit crossword' : 'Set up crossword'),
      ]);
    };
  },
});
