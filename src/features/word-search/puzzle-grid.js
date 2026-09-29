import { lineCells } from './game-model.js';
import { defaultDisplayOptions, displayStyles } from './display-options.js';
import { useGridSizing } from './grid-sizing.js';
import { wordOutline } from './word-outline.js';

const { computed, h, nextTick, onDeactivated, ref, watch } = window.Vue;

export const PuzzleGrid = {
  name: 'PuzzleGrid',
  props: {
    game: { type: Object, required: true },
    revealed: Boolean,
    hint: { type: Number, default: null },
    options: { type: Object, default: defaultDisplayOptions },
    helpId: { type: String, default: 'word-search-play-help' },
    attempt: { type: Object, default: null },
    rotationTurns: { type: Number, default: 0 },
    rotating: Boolean,
  },
  emits: ['select'],
  setup(props, { emit, expose }) {
    const grid = ref(null);
    const area = ref(null);
    const focused = ref(0);
    const anchor = ref(null);
    const endpoint = ref(null);
    const pointerPoint = ref(null);
    let pointer = null;
    let pointerType = '';

    const size = computed(() => props.game.rows.length);
    const options = computed(() => props.options);
    const cellSize = useGridSizing(area, size, options);
    const selected = computed(() => new Set(lineCells(anchor.value, endpoint.value, size.value)));
    const found = computed(() => new Set(props.game.found.flatMap(({ start, end }) =>
      lineCells(start, end, size.value))));
    const answers = computed(() => new Set(props.revealed
      ? props.game.placements.flatMap(({ start, end }) => lineCells(start, end, size.value)) : []));
    const rotation = computed(() => ((Math.round(props.rotationTurns) % 4) + 4) % 4);

    function visualToSource(row, col) {
      const last = size.value - 1;
      if (rotation.value === 1) return { row: last - col, col: row };
      if (rotation.value === 2) return { row: last - row, col: last - col };
      if (rotation.value === 3) return { row: col, col: last - row };
      return { row, col };
    }

    function sourceToVisual(row, col) {
      const last = size.value - 1;
      if (rotation.value === 1) return { row: col, col: last - row };
      if (rotation.value === 2) return { row: last - row, col: last - col };
      if (rotation.value === 3) return { row: last - col, col: row };
      return { row, col };
    }

    function visualPointToSource(x, y) {
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

    function focusCell(cell) {
      focused.value = cell;
      nextTick(() => grid.value?.querySelector(`[data-cell="${cell}"]`)?.focus());
    }
    expose({ focusCell, cancelSelection });

    function activate(cell) {
      if (props.revealed || props.rotating) return;
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

    function cellAt(event) {
      const bounds = grid.value.getBoundingClientRect();
      const visualCol = Math.floor((event.clientX - bounds.left) / bounds.width * size.value);
      const visualRow = Math.floor((event.clientY - bounds.top) / bounds.height * size.value);
      if (visualCol < 0 || visualRow < 0 || visualCol >= size.value || visualRow >= size.value) return null;
      const source = visualToSource(visualRow, visualCol);
      return source.row * size.value + source.col;
    }

    function pointerDown(event) {
      pointerType = event.pointerType;
      if (event.pointerType !== 'mouse' || event.button !== 0 || props.revealed || props.rotating) return;
      const start = cellAt(event);
      if (start === null) return;
      pointer = { id: event.pointerId, start, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      focusCell(start);
    }

    function pointerMove(event) {
      if (props.revealed || props.rotating || event.pointerType !== 'mouse') return;
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

    function pointerUp(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      const { start, moved } = pointer;
      const end = cellAt(event);
      pointer = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (end === null) { cancelSelection(); return; }
      if (moved) {
        emit('select', start, end);
        cancelSelection();
      } else activate(start);
    }

    function keyboard(event, cell) {
      if (props.rotating) return;
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
        ...props.game.found.map(({ word, start, end }) =>
          wordOutline(start, end, size.value, `found-${word}`, 'found', null, word, boardDegrees)),
        ...(props.revealed ? props.game.placements
          .filter(({ word }) => !props.game.found.some((entry) => entry.word === word))
          .map(({ word, start, end }) =>
            wordOutline(start, end, size.value, `answer-${word}`, 'answer', null, word, boardDegrees)) : []),
        props.hint !== null ? wordOutline(props.hint, props.hint, size.value, 'hint', 'hint') : null,
        props.attempt && !props.attempt.matched ? wordOutline(
          props.attempt.start, props.attempt.end, size.value,
          `miss-${props.attempt.id}`, 'miss') : null,
        anchor.value !== null ? wordOutline(
          anchor.value, endpoint.value ?? anchor.value, size.value,
          'selection', 'selection', pointerPoint.value) : null,
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
          h('div', {
            class: ['word-search-board-rotator', { 'is-rotating': props.rotating }],
            style: {
              '--board-to': `${props.rotationTurns * 90}deg`,
              '--letter-to': `${-props.rotationTurns * 90}deg`,
            },
          }, [
            h('div', { class: 'word-search-board-frame' }, [
              outlines(),
              h('div', {
                ref: grid,
                class: 'word-search-grid',
                role: 'grid',
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
                    'is-selected': selected.value.has(cell),
                    'is-answer': answers.value.has(cell),
                    'is-hint': props.hint === cell,
                  }],
                  tabindex: focused.value === cell ? 0 : -1,
                  'aria-label': `${letter}, row ${rowIndex + 1}, column ${col + 1}${found.value.has(cell) ? ', found' : ''}`,
                  'aria-selected': selected.value.has(cell),
                  onFocus: () => { focused.value = cell; },
                  onClick: (event) => {
                    if (event.detail === 0 || pointerType !== 'mouse') activate(cell);
                  },
                  onKeydown: (event) => keyboard(event, cell),
                }, [
                  h('span', {
                    key: attemptCell ? props.attempt.id : 'letter',
                    class: [
                      'word-search-letter-upright',
                      ...(attemptCell ? [
                        'word-search-attempt-letter',
                        { 'attempt-miss': !props.attempt.matched },
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
        ]),
      ]),
      h('p', { class: 'word-search-help', role: 'status' }, anchor.value === null
        ? 'Choose a word’s first and last letters.'
        : `Start: row ${Math.floor(anchor.value / size.value) + 1}, column ${anchor.value % size.value + 1}. Choose the last letter; Escape or the starting cell cancels.`),
    ]);
  },
};
