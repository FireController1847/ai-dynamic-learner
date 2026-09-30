import type { DisplayOptions } from './display-options.ts';
import type { Direction, Game, Placement } from './game-model.ts';
import { answerForCell, placementCells } from './game-model.ts';
import { displayStyles } from './display-options.ts';
import { useGridSizing } from './grid-sizing.ts';

import { defineComponent, type PropType, computed, h, nextTick, ref } from 'vue';

export interface PuzzleGridHandle {
  focusCell(cell: number, direction?: Direction): void;
}

export const PuzzleGrid = defineComponent({
  name: 'CrosswordPuzzleGrid',
  props: {
    game: { type: Object as PropType<Game>, required: true },
    options: { type: Object as PropType<DisplayOptions>, required: true },
    activeCell: { type: Number as PropType<number | null>, default: null },
    direction: { type: String as PropType<Direction>, default: 'across' },
    revealed: Boolean,
    showIncorrect: Boolean,
  },
  emits: {
    'activate': (_cell: number, _direction: Direction) => true,
    'input': (_cell: number, _letter: string) => true,
  },
  setup(props, { emit, expose }) {
    const area = ref<HTMLElement | null>(null);
    const cells = new Map<number, HTMLButtonElement>();
    const size = computed(() => props.game.rows.length);
    const optionRef = computed(() => props.options);
    const cellSize = useGridSizing(area, size, optionRef);
    const activePlacement = computed(() =>
      props.activeCell === null ? null : answerForCell(props.game, props.activeCell, props.direction));
    const activeWordCells = computed(() => new Set(activePlacement.value
      ? placementCells(activePlacement.value, activePlacement.value.answer.length, size.value)
      : []));

    const starts = computed(() => {
      const result = new Map<number, number>();
      for (const placement of props.game.placements) {
        result.set(placement.row * size.value + placement.column, placement.number);
      }
      return result;
    });

    function directionsAt(cell: number): Direction[] {
      return (['across', 'down'] as const).filter((direction) => Boolean(answerForCell(props.game, cell, direction)));
    }

    async function activate(cell: number, requested?: Direction) {
      const available = directionsAt(cell);
      if (!available.length) return;
      let direction = requested && available.includes(requested) ? requested : props.direction;
      if (!available.includes(direction)) direction = available[0];
      if (props.activeCell === cell && available.length === 2 && !requested) {
        direction = props.direction === 'across' ? 'down' : 'across';
      }
      emit('activate', cell, direction);
      await nextTick();
      cells.get(cell)?.focus();
    }

    function focusCell(cell: number, direction?: Direction) {
      activate(cell, direction);
    }
    expose({ focusCell });

    function moveWithinWord(offset: number) {
      if (props.activeCell === null) return;
      const placement = answerForCell(props.game, props.activeCell, props.direction);
      if (!placement) return;
      const path = placementCells(placement, placement.answer.length, size.value);
      const index = path.indexOf(props.activeCell);
      const next = path[Math.max(0, Math.min(path.length - 1, index + offset))];
      if (next !== undefined) activate(next, props.direction);
    }

    function moveSpatial(cell: number, dr: number, dc: number, direction: Direction) {
      let row = Math.floor(cell / size.value) + dr;
      let column = cell % size.value + dc;
      while (row >= 0 && column >= 0 && row < size.value && column < size.value) {
        const next = row * size.value + column;
        if (props.game.rows[row][column] !== '#') {
          activate(next, direction);
          return;
        }
        row += dr;
        column += dc;
      }
    }

    function keydown(event: KeyboardEvent, cell: number) {
      if (props.revealed) return;
      const letter = event.key.length === 1 && /^[a-zA-Z]$/.test(event.key) ? event.key.toUpperCase() : '';
      if (letter) {
        event.preventDefault();
        emit('input', cell, letter);
        nextTick(() => moveWithinWord(1));
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        if (props.game.cells[cell]) emit('input', cell, '');
        else {
          const placement = answerForCell(props.game, cell, props.direction);
          if (!placement) return;
          const path = placementCells(placement, placement.answer.length, size.value);
          const index = path.indexOf(cell);
          const previous = path[index - 1];
          if (previous !== undefined) {
            emit('input', previous, '');
            activate(previous, props.direction);
          }
        }
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        emit('input', cell, '');
        return;
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        activate(cell);
        return;
      }

      const moves: Record<string, [number, number, Direction]> = {
        ArrowLeft: [0, -1, 'across'],
        ArrowRight: [0, 1, 'across'],
        ArrowUp: [-1, 0, 'down'],
        ArrowDown: [1, 0, 'down'],
      };
      const move = moves[event.key];
      if (move) {
        event.preventDefault();
        moveSpatial(cell, ...move);
      }
    }

    return () => h('div', {
      ref: area,
      class: ['crossword-board-area', { 'is-screen-fit': props.options.fit === 'screen' }],
      style: {
        ...displayStyles(props.options),
        '--crossword-size': size.value,
        '--crossword-cell-size': `${cellSize.value}px`,
      },
    }, [
      h('div', { class: 'crossword-board-scroll' }, [
        h('div', {
          class: 'crossword-grid',
          role: 'grid',
          'aria-label': `${size.value} by ${size.value} crossword`,
          'aria-rowcount': size.value,
          'aria-colcount': size.value,
        }, Array.from({ length: size.value }, (_, row) =>
          h('div', { class: 'crossword-grid-row', role: 'row' },
            Array.from({ length: size.value }, (_, column) => {
              const cell = row * size.value + column;
              const solution = props.game.rows[row][column];
              if (solution === '#') {
                return h('span', {
                  class: 'crossword-cell crossword-cell-block',
                  role: 'gridcell',
                  'aria-label': 'Blocked cell',
                });
              }

              const entered = props.game.cells[cell];
              const shown = props.revealed ? solution : entered;
              const incorrect = props.showIncorrect && Boolean(entered) && entered !== solution;
              const selected = props.activeCell === cell;
              const inWord = activeWordCells.value.has(cell);
              return h('button', {
                ref: (element) => {
                  if (element instanceof HTMLButtonElement) cells.set(cell, element);
                  else cells.delete(cell);
                },
                type: 'button',
                class: ['crossword-cell', 'crossword-cell-open', {
                  'is-active': selected,
                  'is-word': inWord,
                  'is-incorrect': incorrect,
                  'is-revealed': props.revealed,
                }],
                role: 'gridcell',
                tabindex: selected || (props.activeCell === null && cell === props.game.rows.join('').search(/[A-Z]/)) ? 0 : -1,
                'aria-selected': selected,
                'aria-label': `Row ${row + 1}, column ${column + 1}${shown ? `, ${shown}` : ', blank'}`,
                onClick: () => activate(cell),
                onFocus: () => {
                  if (props.activeCell !== cell) {
                    const available = directionsAt(cell);
                    emit('activate', cell, available.includes(props.direction) ? props.direction : available[0] ?? 'across');
                  }
                },
                onKeydown: (event: KeyboardEvent) => keydown(event, cell),
              }, [
                starts.value.has(cell) ? h('span', { class: 'crossword-cell-number', 'aria-hidden': 'true' }, starts.value.get(cell)) : null,
                h('span', { class: 'crossword-cell-letter', 'aria-hidden': 'true' }, shown),
              ]);
            })))),
      ]),
    ]);
  },
});
