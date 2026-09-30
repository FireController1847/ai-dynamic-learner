import type { CrosswordItem } from './library-model.ts';
import type { Puzzle } from './puzzle-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import {
  GRID_SIZES, MAX_ANSWER_INPUT_LENGTH, MAX_CLUE_LENGTH, MAX_ENTRIES,
  MAX_INSTRUCTIONS_LENGTH, MIN_ENTRIES, parseAnswers, validatePuzzle,
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
    const size = ref<number>(props.item?.puzzle?.size ?? 15);
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
        if (parsed.value.error) throw new Error(parsed.value.error);
        const puzzle = {
          entries: parsed.value.answers.map((answer) => ({
            answer,
            clue: clues.value[answer]?.trim() ?? '',
          })),
          size: size.value,
          instructions: instructions.value.trim(),
        };
        validatePuzzle(puzzle);
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
        h('p', `Saved in ${props.destination}. Add answers and clues, then choose a grid size.`),
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
            `Add ${MIN_ENTRIES}–${MAX_ENTRIES} answers, one per line or separated by commas. Spaces and common punctuation are removed from the grid answer.`),
          h('textarea', {
            id: 'crossword-answers',
            rows: 10,
            required: true,
            maxlength: MAX_ANSWER_INPUT_LENGTH,
            placeholder: 'ALGORITHM\nCOMPILER\nBINARY',
            value: answersText.value,
            spellcheck: false,
            'aria-describedby': 'crossword-answers-help crossword-answer-count',
            onInput: (event: Event) => { answersText.value = inputValue(event); },
          }),
          h('p', { id: 'crossword-answer-count', class: 'crossword-help', role: 'status' },
            `${parsed.value.answers.length} / ${MAX_ENTRIES} unique answers${parsed.value.duplicates ? ` · ${parsed.value.duplicates} duplicate entries combined` : ''}`),
          parsed.value.error ? h('p', { class: 'crossword-error' }, parsed.value.error) : null,
        ]),
        h('div', { class: 'crossword-options' }, [
          h('div', { class: 'crossword-field' }, [
            h('label', { for: 'crossword-size' }, 'Grid size'),
            h('select', {
              id: 'crossword-size',
              value: size.value,
              onChange: (event: Event) => { size.value = Number(inputValue(event)); },
            }, GRID_SIZES.map((value) => h('option', { value }, `${value} × ${value}`))),
            h('p', { class: 'crossword-help' },
              'Larger grids give the generator more room to build clean crossings.'),
          ]),
          parsed.value.answers.length ? h('div', { class: 'crossword-answer-preview' }, [
            h('h3', 'Answer preview'),
            h('ul', { class: 'crossword-answer-chips' }, parsed.value.answers.map((answer) =>
              h('li', { key: answer, class: { 'is-too-long': answer.length > size.value } }, [
                answer,
                answer.length > size.value ? h('span', ' · too long for this grid') : null,
              ]))),
          ]) : null,
        ]),
      ]),
      parsed.value.answers.length ? h('section', {
        class: 'crossword-clue-editor',
        'aria-labelledby': 'crossword-clue-heading',
      }, [
        h('h3', { id: 'crossword-clue-heading' }, 'Clues'),
        h('p', { class: 'crossword-help' }, 'Write one clue for each answer. Clue numbering is assigned automatically when the grid is generated.'),
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
        ? 'Changing answers or grid size creates a new layout and clears typed letters. Title, clues, and instructions keep the current layout and progress.'
        : 'Your crossword will be generated after saving. The generator prefers crossings and uses separated entries only when your answers do not share enough letters.'),
      h('div', { class: 'crossword-form-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        h('button', { type: 'submit', class: 'card-primary-button' }, [
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
      return h('div', { class: 'crossword-puzzle-summary' }, [
        h('h3', puzzle ? 'Puzzle setup' : 'Add your puzzle details'),
        puzzle ? h('p', { class: 'crossword-help' },
          `${puzzle.entries.length} answers · ${puzzle.size} × ${puzzle.size} grid`) : null,
        puzzle?.instructions ? h('p', { class: 'crossword-instructions' }, puzzle.instructions) : null,
        puzzle ? h('ul', { class: 'crossword-answer-chips' },
          puzzle.entries.map(({ answer }) => h('li', { key: answer }, answer))) : null,
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') },
          puzzle ? 'Edit crossword' : 'Set up crossword'),
      ]);
    };
  },
});
