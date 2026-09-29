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
    const found = computed(() => new Set(props.game.found.flatMap(({ start, end }) => lineCells(start, end, size.value))));
    const answers = computed(() => new Set(props.revealed
      ? props.game.placements.flatMap(({ start, end }) => lineCells(start, end, size.value)) : []));

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
    expose({ focusCell });

    function activate(cell) {
      if (props.revealed) return;
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
      const col = Math.floor((event.clientX - bounds.left) / bounds.width * size.value);
      const row = Math.floor((event.clientY - bounds.top) / bounds.height * size.value);
      return col < 0 || row < 0 || col >= size.value || row >= size.value ? null : row * size.value + col;
    }

    function pointerDown(event) {
      pointerType = event.pointerType;
      // Touch uses two taps, allowing native scrolling and zoom over large grids.
      if (event.pointerType !== 'mouse' || event.button !== 0 || props.revealed) return;
      const start = cellAt(event);
      if (start === null) return;
      pointer = { id: event.pointerId, start, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      focusCell(start);
    }

    function pointerMove(event) {
      if (props.revealed || event.pointerType !== 'mouse') return;
      const cell = cellAt(event);
      if (pointer && pointer.id !== event.pointerId) return;
      if (pointer && cell !== null && cell !== pointer.start) pointer.moved = true;
      if (pointer?.moved) {
        anchor.value = pointer.start;
      }
      if (anchor.value === null || cell === null) return;
      endpoint.value = cell;
      const bounds = grid.value.getBoundingClientRect();
      pointerPoint.value = {
        x: Math.max(0.5, Math.min(size.value - 0.5, (event.clientX - bounds.left) / bounds.width * size.value)),
        y: Math.max(0.5, Math.min(size.value - 0.5, (event.clientY - bounds.top) / bounds.height * size.value)),
      };
    }

    function pointerUp(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      const { start, moved } = pointer;
      const end = cellAt(event);
      pointer = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (end === null) { cancelSelection(); return; }
      if (moved) {
        emit('select', start, end);
        cancelSelection();
      } else activate(start);
    }

    function keyboard(event, cell) {
      const row = Math.floor(cell / size.value);
      const col = cell % size.value;
      let next = cell;
      if (event.key === 'ArrowLeft') next = row * size.value + Math.max(0, col - 1);
      else if (event.key === 'ArrowRight') next = row * size.value + Math.min(size.value - 1, col + 1);
      else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * size.value + col;
      else if (event.key === 'ArrowDown') next = Math.min(size.value - 1, row + 1) * size.value + col;
      else if (event.key === 'Home') next = event.ctrlKey ? 0 : row * size.value;
      else if (event.key === 'End') next = event.ctrlKey ? size.value * size.value - 1 : (row + 1) * size.value - 1;
      else if (event.key === 'Escape') { event.preventDefault(); cancelSelection(); return; }
      else return;
      event.preventDefault();
      pointerPoint.value = null;
      if (anchor.value !== null) endpoint.value = next;
      focusCell(next);
    }

    function outlines() {
      return h('svg', {
        class: 'word-search-outlines', viewBox: `0 0 ${size.value} ${size.value}`,
        'aria-hidden': 'true', focusable: 'false',
      }, [
        ...props.game.found.map(({ word, start, end }) => wordOutline(start, end, size.value, `found-${word}`, 'found', null, word)),
        ...(props.revealed ? props.game.placements.filter(({ word }) => !props.game.found.some((entry) => entry.word === word))
          .map(({ word, start, end }) => wordOutline(start, end, size.value, `answer-${word}`, 'answer', null, word)) : []),
        props.hint !== null ? wordOutline(props.hint, props.hint, size.value, 'hint', 'hint') : null,
        props.attempt && !props.attempt.matched ? wordOutline(
          props.attempt.start,
          props.attempt.end,
          size.value,
          `miss-${props.attempt.id}`,
          'miss',
        ) : null,
        anchor.value !== null ? wordOutline(anchor.value, endpoint.value ?? anchor.value, size.value,
          'selection', 'selection', pointerPoint.value) : null,
      ]);
    }

    return () => h('div', {
      ref: area, class: ['word-search-board-area', { 'instant-highlights': props.options.motion === 'none' }],
      style: { ...displayStyles(props.options), '--search-cell-size': `${cellSize.value}px`, '--puzzle-size': size.value },
    }, [
      h('div', { class: 'word-search-board-scroll', 'aria-label': 'Scrollable puzzle' }, [
        h('div', { class: 'word-search-board-frame' }, [
          outlines(),
          h('div', {
            ref: grid, class: 'word-search-grid', role: 'grid',
            'aria-label': `${size.value} by ${size.value} word search`,
            'aria-describedby': props.helpId,
            'aria-rowcount': size.value, 'aria-colcount': size.value,
            style: { '--puzzle-size': size.value },
            onPointerdown: pointerDown, onPointermove: pointerMove, onPointerup: pointerUp,
            onPointercancel: cancelSelection,
            onPointerleave: () => { if (!pointer) { pointerPoint.value = null; endpoint.value = anchor.value; } },
            onLostpointercapture: () => { if (pointer) cancelSelection(); },
          }, props.game.rows.map((row, rowIndex) => h('div', {
            role: 'row', class: 'word-search-grid-row', key: rowIndex,
          }, [...row].map((letter, col) => {
            const cell = rowIndex * size.value + col;
            return h('button', {
              type: 'button', role: 'gridcell', key: cell, 'data-cell': cell,
              class: ['word-search-cell', {
                'is-found': found.value.has(cell), 'is-selected': selected.value.has(cell),
                'is-answer': answers.value.has(cell), 'is-hint': props.hint === cell,
              }],
              tabindex: focused.value === cell ? 0 : -1,
              'aria-label': `${letter}, row ${rowIndex + 1}, column ${col + 1}${found.value.has(cell) ? ', found' : ''}`,
              'aria-selected': selected.value.has(cell),
              onFocus: () => { focused.value = cell; },
              onClick: (event) => { if (event.detail === 0 || pointerType !== 'mouse') activate(cell); },
              onKeydown: (event) => keyboard(event, cell),
            }, [h('span', {
              key: props.attempt?.cells.includes(cell) ? props.attempt.id : 'letter',
              class: props.attempt?.cells.includes(cell) ? [
                'word-search-attempt-letter', { 'attempt-miss': !props.attempt.matched },
              ] : null,
            }, letter)]);
          })))),
        ]),
      ]),
      h('p', { class: 'word-search-help', role: 'status' }, anchor.value === null
        ? 'Choose a word’s first and last letters.'
        : `Start: row ${Math.floor(anchor.value / size.value) + 1}, column ${anchor.value % size.value + 1}. Choose the last letter; Escape or the starting cell cancels.`),
    ]);
  },
};
