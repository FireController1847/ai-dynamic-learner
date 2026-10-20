import type { Game } from './game-model.ts';
import type { DisplayOptions } from './display-options.ts';
import type { GridPoint } from './word-outline.ts';
export interface SelectionAttempt { id: number; start: number; end: number; cells: number[]; matched: boolean; revealed?: boolean }
export interface WordCelebration { id: number; start: number; end: number; complete: boolean; revealed?: boolean }
export interface PuzzleGridHandle {
  focusCell(cell: number): void;
  cancelSelection(): void;
  focusCompletionCancel(): void;
  focusCompletionAction(): void;
  focusViewButton(): void;
}
import { lineCells } from './game-model.ts';
import { defaultDisplayOptions, displayStyles } from './display-options.ts';
import { Icon } from '../../components/icon.ts';
import { useGridSizing } from './grid-sizing.ts';
import { wordOutline } from './word-outline.ts';

import { defineComponent, type PropType, computed, h, nextTick, onDeactivated, ref, Transition, watch } from 'vue';

export const PuzzleGrid = defineComponent({
  name: 'PuzzleGrid',
  props: {
    game: { type: Object as PropType<Game>, required: true },
    revealed: Boolean,
    hint: { type: Number as PropType<number | null>, default: null },
    options: { type: Object as PropType<DisplayOptions>, default: defaultDisplayOptions },
    helpId: { type: String, default: 'word-search-play-help' },
    attempt: { type: Object as PropType<SelectionAttempt | null>, default: null },
    celebration: { type: Object as PropType<WordCelebration | null>, default: null },
    covered: Boolean,
    finished: Boolean,
    viewingBoard: Boolean,
    score: { type: Object as PropType<{ earned: number; possible: number }>,
      default: () => ({ earned: 0, possible: 0 }) },
    pendingAction: { type: String as PropType<'new' | 'restart' | null>, default: null },
    rotationTurns: { type: Number, default: 0 },
    rotating: Boolean,
  },
  emits: {
    'select': (_start: number, _end: number) => true,
    'restart': (_event: MouseEvent) => true,
    'new-layout': (_event: MouseEvent) => true,
    'cancel-action': () => true,
    'confirm-action': () => true,
    'view-board': () => true,
    'view-results': () => true,
  },
  setup(props, { emit, expose }) {
    const grid = ref<HTMLElement | null>(null);
    const area = ref<HTMLElement | null>(null);
    const completionCancel = ref<HTMLButtonElement | null>(null);
    const completionAction = ref<HTMLButtonElement | null>(null);
    const viewButton = ref<HTMLButtonElement | null>(null);
    const focused = ref(0);
    const anchor = ref<number | null>(null);
    const endpoint = ref<number | null>(null);
    const pointerPoint = ref<GridPoint | null>(null);
    let pointer: { id: number; start: number; moved: boolean } | null = null;
    let pointerType = '';

    const size = computed(() => props.game.rows.length);
    const options = computed(() => props.options);
    const cellSize = useGridSizing(area, size, options);
    const selected = computed(() => new Set(lineCells(anchor.value, endpoint.value, size.value)));
    const found = computed(() => new Set(props.game.found.flatMap(({ start, end }) =>
      lineCells(start, end, size.value))));
    const revealedFound = computed(() => new Set(props.game.found
      .filter((entry) => entry.revealed)
      .flatMap(({ start, end }) => lineCells(start, end, size.value))));
    const answers = computed(() => new Set(props.revealed
      ? props.game.placements.flatMap(({ start, end }) => lineCells(start, end, size.value)) : []));
    const rotation = computed(() => ((Math.round(props.rotationTurns) % 4) + 4) % 4);

    function visualToSource(row: number, col: number) {
      const last = size.value - 1;
      if (rotation.value === 1) return { row: last - col, col: row };
      if (rotation.value === 2) return { row: last - row, col: last - col };
      if (rotation.value === 3) return { row: col, col: last - row };
      return { row, col };
    }

    function sourceToVisual(row: number, col: number) {
      const last = size.value - 1;
      if (rotation.value === 1) return { row: col, col: last - row };
      if (rotation.value === 2) return { row: last - row, col: last - col };
      if (rotation.value === 3) return { row: last - col, col: row };
      return { row, col };
    }

    function visualPointToSource(x: number, y: number) {
      const extent = size.value;
      if (rotation.value === 1) return { x: y, y: extent - x };
      if (rotation.value === 2) return { x: extent - x, y: extent - y };
      if (rotation.value === 3) return { x: extent - y, y: x };
      return { x, y };
    }

    function cancelSelection() {
      anchor.value = null;
      endpoint.value = null;
      pointerPoint.value = null;
      pointer = null;
    }

    watch(() => props.revealed, cancelSelection);
    watch(() => props.hint, cancelSelection);
    onDeactivated(cancelSelection);

    function focusCell(cell: number) {
      focused.value = cell;
      nextTick(() => grid.value?.querySelector<HTMLElement>(`[data-cell="${cell}"]`)?.focus());
    }
    expose({
      focusCell,
      cancelSelection,
      focusCompletionCancel: () => completionCancel.value?.focus(),
      focusCompletionAction: () => completionAction.value?.focus(),
      focusViewButton: () => viewButton.value?.focus(),
    });

    function activate(cell: number) {
      if (props.revealed || props.rotating || props.finished) return;
      if (anchor.value === null) {
        pointerPoint.value = null;
        anchor.value = cell;
        endpoint.value = cell;
      } else if (anchor.value === cell) cancelSelection();
      else {
        emit('select', anchor.value, cell);
        cancelSelection();
      }
    }

    function cellAt(event: PointerEvent) {
      if (!grid.value) return null;
      const bounds = grid.value.getBoundingClientRect();
      const visualCol = Math.floor((event.clientX - bounds.left) / bounds.width * size.value);
      const visualRow = Math.floor((event.clientY - bounds.top) / bounds.height * size.value);
      if (visualCol < 0 || visualRow < 0 || visualCol >= size.value || visualRow >= size.value) return null;
      const source = visualToSource(visualRow, visualCol);
      return source.row * size.value + source.col;
    }

    function pointerDown(event: PointerEvent) {
      pointerType = event.pointerType;
      if (event.pointerType !== 'mouse' || event.button !== 0 || props.revealed || props.rotating || props.finished) return;
      const start = cellAt(event);
      if (start === null) return;
      pointer = { id: event.pointerId, start, moved: false };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      focusCell(start);
    }

    function pointerMove(event: PointerEvent) {
      if (!grid.value) return;
      if (props.revealed || props.rotating || props.finished || event.pointerType !== 'mouse') return;
      const cell = cellAt(event);
      if (pointer && pointer.id !== event.pointerId) return;
      if (pointer && cell !== null && cell !== pointer.start) pointer.moved = true;
      if (pointer?.moved) anchor.value = pointer.start;
      if (anchor.value === null || cell === null) return;

      endpoint.value = cell;
      const bounds = grid.value.getBoundingClientRect();
      const visualX = Math.max(0.5, Math.min(size.value - 0.5,
        (event.clientX - bounds.left) / bounds.width * size.value));
      const visualY = Math.max(0.5, Math.min(size.value - 0.5,
        (event.clientY - bounds.top) / bounds.height * size.value));
      pointerPoint.value = visualPointToSource(visualX, visualY);
    }

    function pointerUp(event: PointerEvent) {
      if (!pointer || pointer.id !== event.pointerId) return;
      const { start, moved } = pointer;
      const end = cellAt(event);
      pointer = null;
      if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      }
      if (end === null) { cancelSelection(); return; }
      if (moved) {
        emit('select', start, end);
        cancelSelection();
      } else activate(start);
    }

    function keyboard(event: KeyboardEvent, cell: number) {
      if (props.rotating || props.finished) return;
      const sourceRow = Math.floor(cell / size.value);
      const sourceCol = cell % size.value;
      const visual = sourceToVisual(sourceRow, sourceCol);
      let visualRow = visual.row;
      let visualCol = visual.col;

      if (event.key === 'ArrowLeft') visualCol = Math.max(0, visualCol - 1);
      else if (event.key === 'ArrowRight') visualCol = Math.min(size.value - 1, visualCol + 1);
      else if (event.key === 'ArrowUp') visualRow = Math.max(0, visualRow - 1);
      else if (event.key === 'ArrowDown') visualRow = Math.min(size.value - 1, visualRow + 1);
      else if (event.key === 'Home') {
        visualRow = event.ctrlKey ? 0 : visualRow;
        visualCol = 0;
      } else if (event.key === 'End') {
        visualRow = event.ctrlKey ? size.value - 1 : visualRow;
        visualCol = size.value - 1;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelSelection();
        return;
      } else return;

      const source = visualToSource(visualRow, visualCol);
      const next = source.row * size.value + source.col;
      event.preventDefault();
      pointerPoint.value = null;
      if (anchor.value !== null) endpoint.value = next;
      focusCell(next);
    }

    function outlines() {
      const boardDegrees = props.rotationTurns * 90;
      return h('svg', {
        class: 'word-search-outlines',
        viewBox: `0 0 ${size.value} ${size.value}`,
        'aria-hidden': 'true',
        focusable: 'false',
      }, [
        ...props.game.found.map(({ word, start, end, revealed }) =>
          wordOutline(start, end, size.value, `found-${word}`,
            revealed ? 'found-revealed' : 'found', null, word, boardDegrees)),
        ...(props.revealed ? props.game.placements
          .filter(({ word }) => !props.game.found.some((entry) => entry.word === word))
          .map(({ word, start, end }) =>
            wordOutline(start, end, size.value, `answer-${word}`, 'answer', null, word, boardDegrees)) : []),
        props.hint !== null ? wordOutline(props.hint, props.hint, size.value, 'hint', 'hint') : null,
        props.attempt && !props.attempt?.matched ? wordOutline(
          props.attempt.start, props.attempt.end, size.value,
          `miss-${props.attempt?.id}`, 'miss') : null,
        props.celebration ? wordOutline(
          props.celebration.start, props.celebration.end, size.value,
          `success-${props.celebration.id}`,
          props.celebration.revealed ? 'success-revealed' : 'success') : null,
        anchor.value !== null ? wordOutline(
          anchor.value, endpoint.value ?? anchor.value, size.value,
          'selection', 'selection', pointerPoint.value) : null,
      ]);
    }

    function celebrationLayer() {
      if (!props.celebration) return null;
      const startRow = Math.floor(props.celebration.start / size.value);
      const startCol = props.celebration.start % size.value;
      const endRow = Math.floor(props.celebration.end / size.value);
      const endCol = props.celebration.end % size.value;
      const midpointX = ((startCol + endCol) / 2 + 0.5) / size.value * 100;
      const midpointY = ((startRow + endRow) / 2 + 0.5) / size.value * 100;

      const sparks = Array.from({ length: 8 }, (_, index) =>
        h('span', {
          key: `spark-${props.celebration?.id}-${index}`,
          class: ['word-search-success-spark', `spark-${index + 1}`],
          'aria-hidden': 'true',
        }, index % 2 ? '✦' : '•'));

      const completionPieces = props.celebration.complete
        ? Array.from({ length: 18 }, (_, index) => h('span', {
          key: `complete-${props.celebration?.id}-${index}`,
          class: ['word-search-completion-piece', { 'is-star': index % 3 === 0 }],
          'aria-hidden': 'true',
        }, index % 3 === 0 ? '✦' : ''))
        : [];

      return h('div', {
        key: `celebration-${props.celebration.id}`,
        class: ['word-search-celebration-layer', {
          'is-complete': props.celebration.complete,
          'is-revealed': !!props.celebration.revealed,
        }],
        'aria-hidden': 'true',
      }, [
        h('div', {
          class: 'word-search-success-burst',
          style: { left: `${midpointX}%`, top: `${midpointY}%` },
        }, sparks),
        props.celebration.complete ? h('div', {
          class: 'word-search-completion-wash',
        }) : null,
        props.celebration.complete ? h('div', {
          class: 'word-search-completion-party',
        }, completionPieces) : null,
      ]);
    }

    function finishedActions(inToolbar: boolean) {
      const pending = props.pendingAction;
      return h('div', { class: 'word-search-completion-actions' }, pending ? [
        h('button', {
          ref: completionCancel, type: 'button', class: 'quiet-button',
          onClick: () => emit('cancel-action'),
        }, 'Cancel'),
        h('button', { type: 'button', class: 'card-primary-button',
          onClick: () => emit('confirm-action') },
          pending === 'new' ? 'Create new layout' : 'Start over'),
      ] : [
        h('button', {
          ref: viewButton, type: 'button', class: 'quiet-button word-search-finish-view',
          onClick: () => {
            if (inToolbar) emit('view-results');
            else emit('view-board');
          },
        }, inToolbar ? 'View results' : 'View board'),
        h('button', {
          ref: completionAction, type: 'button', class: 'quiet-button',
          onClick: (event: MouseEvent) => emit('restart', event),
        }, 'Start over'),
        h('button', { type: 'button', class: 'card-primary-button',
          onClick: (event: MouseEvent) => emit('new-layout', event) }, 'New layout'),
      ]);
    }

    function completionOverlay() {
      if (!props.covered) return null;
      const pending = props.pendingAction;
      const givenUp = props.game.gaveUp === true;
      return h('section', {
        class: ['word-search-completion-overlay', { 'is-given-up': givenUp }],
        role: 'region',
        'aria-label': 'Word search results',
        onKeydown: (event: KeyboardEvent) => {
          if (pending && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            emit('cancel-action');
          }
        },
      }, [
        h('div', { class: 'word-search-completion-content' }, [
          h('div', { class: 'word-search-completion-seal', 'aria-hidden': 'true' }, [
            h(Icon, { name: givenUp ? 'flag' : 'verified' }),
          ]),
          h('h3', pending ? (pending === 'new' ? 'Create a new layout?' : 'Start this board over?')
            : givenUp ? 'Board ended' : 'Puzzle complete!'),
          h('p', pending
            ? (pending === 'new'
              ? 'A new arrangement replaces this board and clears its progress.'
              : 'This clears found-word progress but keeps the same board and revealed clues.')
            : givenUp
              ? `You found ${props.game.found.length} of ${props.score.possible} words. Here is your final score.`
              : `You found all ${props.score.possible} words. Nicely done!`),
          h('div', { class: 'word-search-finish-score', 'aria-label': 'Final score' }, [
            h('strong', `${props.score.earned} / ${props.score.possible}`),
            h('span', `${props.score.possible ? Math.round(100 * props.score.earned / props.score.possible) : 0}% score`),
          ]),
          finishedActions(false),
        ]),
      ]);
    }

    function finishedToolbar() {
      if (!props.viewingBoard || !props.finished) return null;
      const pending = props.pendingAction;
      return h('section', {
        class: 'word-search-finished-toolbar',
        role: 'region',
        'aria-label': 'Word search finished actions',
        onKeydown: (event: KeyboardEvent) => {
          if (pending && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            emit('cancel-action');
          }
        },
      }, [
        h('p', { class: 'word-search-finished-toolbar-score' },
          `Score: ${props.score.earned} / ${props.score.possible}`),
        pending ? h('p', { class: 'word-search-finished-toolbar-note' },
          pending === 'new' ? 'Generate a new layout and reset this board?'
            : 'Clear your found words and start this board over?') : null,
        finishedActions(true),
      ]);
    }

    return () => h('div', {
      ref: area,
      class: ['word-search-board-area', {
        'instant-highlights': props.options.motion === 'none',
        'is-rotating': props.rotating,
      }],
      style: {
        ...displayStyles(props.options),
        '--search-cell-size': `${cellSize.value}px`,
        '--puzzle-size': size.value,
      },
    }, [
      h('div', {
        class: ['word-search-board-scroll', { 'is-screen-fit': props.options.fit === 'screen' }],
        'aria-label': props.options.fit === 'screen' ? 'Puzzle board' : 'Scrollable puzzle',
      }, [
        h('div', { class: 'word-search-board-stage' }, [
          h('div', { class: 'word-search-board-surface' }, [
            h('div', {
            class: ['word-search-board-rotator', { 'is-rotating': props.rotating }],
            style: {
              '--board-to': `${props.rotationTurns * 90}deg`,
              '--letter-to': `${-props.rotationTurns * 90}deg`,
            },
          }, [
            h('div', { class: ['word-search-board-frame', {
              'is-complete-celebrating': Boolean(props.celebration?.complete),
            }] }, [
              outlines(),
              celebrationLayer(),
              h('div', {
                ref: grid,
                class: 'word-search-grid',
                role: 'grid',
                inert: props.finished,
                'aria-label': `${size.value} by ${size.value} word search, rotated ${rotation.value * 90} degrees`,
                'aria-describedby': props.helpId,
                'aria-rowcount': size.value,
                'aria-colcount': size.value,
                style: { '--puzzle-size': size.value },
                onPointerdown: pointerDown,
                onPointermove: pointerMove,
                onPointerup: pointerUp,
                onPointercancel: cancelSelection,
                onPointerleave: () => {
                  if (!pointer) {
                    pointerPoint.value = null;
                    endpoint.value = anchor.value;
                  }
                },
                onLostpointercapture: () => { if (pointer) cancelSelection(); },
              }, props.game.rows.map((row, rowIndex) => h('div', {
                role: 'row',
                class: 'word-search-grid-row',
                key: rowIndex,
              }, [...row].map((letter, col) => {
                const cell = rowIndex * size.value + col;
                const delay = ((rowIndex + col) % 7) * 12;
                const attemptCell = props.attempt?.cells.includes(cell);
                return h('button', {
                  type: 'button',
                  role: 'gridcell',
                  key: cell,
                  'data-cell': cell,
                  class: ['word-search-cell', {
                    'is-found': found.value.has(cell),
                    'is-revealed-found': revealedFound.value.has(cell),
                    'is-selected': selected.value.has(cell),
                    'is-answer': answers.value.has(cell),
                    'is-hint': props.hint === cell,
                  }],
                  tabindex: focused.value === cell ? 0 : -1,
                  'aria-label': `${letter}, row ${rowIndex + 1}, column ${col + 1}${found.value.has(cell) ? ', found' : ''}`,
                  'aria-selected': selected.value.has(cell),
                  onFocus: () => { focused.value = cell; },
                  onClick: (event: MouseEvent) => {
                    if (event.detail === 0 || pointerType !== 'mouse') activate(cell);
                  },
                  onKeydown: (event: KeyboardEvent) => keyboard(event, cell),
                }, [
                  h('span', {
                    key: attemptCell ? props.attempt?.id : 'letter',
                    class: [
                      'word-search-letter-upright',
                      ...(attemptCell ? [
                        'word-search-attempt-letter',
                        { 'attempt-miss': !props.attempt?.matched,
                          'attempt-revealed': !!props.attempt?.revealed },
                      ] : []),
                    ],
                    style: { '--letter-delay': `${delay}ms` },
                  }, [
                    h('span', {
                      class: 'word-search-letter-glyph',
                    }, letter),
                  ]),
                ]);
              })))),
            ]),
          ]),
          h(Transition, { name: 'word-search-finish-cover' },
            { default: completionOverlay }),
          h(Transition, { name: 'word-search-finish-toolbar' },
            { default: finishedToolbar }),
          ]),
        ]),
      ]),
      h('p', { class: 'word-search-help', role: 'status' }, props.finished
        ? 'Board finished. Review the highlighted word paths or choose View results to return to your score.'
        : anchor.value === null
          ? 'Choose a word’s first and last letters.'
          : `Start: row ${Math.floor(anchor.value / size.value) + 1}, column ${anchor.value % size.value + 1}. Choose the last letter; Escape or the starting cell cancels.`),
    ]);
  },
});
