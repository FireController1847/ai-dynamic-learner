import type { ConfiguredCrossword } from './library-model.ts';
import type { DisplayOptions } from './display-options.ts';
import type { PuzzleGridHandle } from './puzzle-grid.ts';
import type { Direction, Placement } from './game-model.ts';
import { answerForCell, clearGame, clueEntry, gameComplete, placementCells, placementSolved } from './game-model.ts';
import { generatePuzzle } from './puzzle-generator.ts';
import { PuzzleGrid } from './puzzle-grid.ts';
import { defaultDisplayOptions, displayStyles } from './display-options.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

export const PuzzleGame = defineComponent({
  name: 'CrosswordPuzzleGame',
  props: {
    item: { type: Object as PropType<ConfiguredCrossword>, required: true },
    options: { type: Object as PropType<DisplayOptions>, default: defaultDisplayOptions },
  },
  emits: { 'edit': () => true },
  setup(props, { emit }) {
    const loading = ref(false);
    const error = ref('');
    const message = ref('');
    const revealed = ref(false);
    const showIncorrect = ref(false);
    const pending = ref<'new' | 'restart' | null>(null);
    const activeCell = ref<number | null>(null);
    const direction = ref<Direction>('across');
    const grid = ref<PuzzleGridHandle | null>(null);
    const gridVersion = ref(0);
    const cancelButton = ref<HTMLButtonElement | null>(null);
    const restartButton = ref<HTMLButtonElement | null>(null);
    const celebratingAnswers = ref<string[]>([]);
    const celebratingComplete = ref(false);
    const wordCelebrationTimers = new Map<string, number>();
    let completeCelebrationTimer: number | undefined;
    let controller: AbortController | null = null;
    let actionTrigger: HTMLElement | null = null;

    const game = computed(() => props.item.game);
    const solvedAnswers = computed(() => new Set(
      game.value?.placements.filter((placement) => placementSolved(game.value!, placement)).map(({ answer }) => answer) ?? [],
    ));
    const complete = computed(() => Boolean(game.value && gameComplete(game.value)));
    const activePlacement = computed(() => activeCell.value === null || !game.value
      ? null
      : answerForCell(game.value, activeCell.value, direction.value));
    const across = computed(() => game.value?.placements
      .filter((placement) => placement.direction === 'across')
      .sort((a, b) => a.number - b.number) ?? []);
    const down = computed(() => game.value?.placements
      .filter((placement) => placement.direction === 'down')
      .sort((a, b) => a.number - b.number) ?? []);

    onMounted(() => {
      if (!game.value) generate();
      else selectInitialCell();
    });
    onBeforeUnmount(() => {
      controller?.abort();
      clearCelebrations();
    });
    onDeactivated(() => {
      pending.value = null;
      revealed.value = false;
      showIncorrect.value = false;
      clearCelebrations();
    });

    function stopWordCelebration(answer: string) {
      const timer = wordCelebrationTimers.get(answer);
      if (timer !== undefined) window.clearTimeout(timer);
      wordCelebrationTimers.delete(answer);
      celebratingAnswers.value = celebratingAnswers.value.filter((candidate) => candidate !== answer);
    }

    function celebrateWord(answer: string) {
      stopWordCelebration(answer);
      celebratingAnswers.value = [...celebratingAnswers.value, answer];
      wordCelebrationTimers.set(answer, window.setTimeout(() => stopWordCelebration(answer), 1100));
    }

    function stopCompleteCelebration() {
      if (completeCelebrationTimer !== undefined) window.clearTimeout(completeCelebrationTimer);
      completeCelebrationTimer = undefined;
      celebratingComplete.value = false;
    }

    function celebrateComplete() {
      stopCompleteCelebration();
      celebratingComplete.value = true;
      completeCelebrationTimer = window.setTimeout(stopCompleteCelebration, 1900);
    }

    function clearCelebrations() {
      for (const timer of wordCelebrationTimers.values()) window.clearTimeout(timer);
      wordCelebrationTimers.clear();
      celebratingAnswers.value = [];
      stopCompleteCelebration();
    }

    function placementLabel(placement: Placement) {
      return `${placement.number} ${placement.direction === 'across' ? 'Across' : 'Down'}`;
    }

    function solvedMessage(placements: readonly Placement[]) {
      const labels = placements.map(placementLabel);
      if (labels.length === 1) return `Solved ${labels[0]}!`;
      if (labels.length === 2) return `Solved ${labels[0]} and ${labels[1]}!`;
      return `Solved ${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}!`;
    }

    function firstOpenCell(): number | null {
      if (!game.value) return null;
      for (let row = 0; row < game.value.rows.length; row += 1) {
        const column = game.value.rows[row].search(/[A-Z]/);
        if (column >= 0) return row * game.value.rows.length + column;
      }
      return null;
    }

    function selectInitialCell() {
      const cell = firstOpenCell();
      if (cell === null || !game.value) return;
      const placement = game.value.placements.find((entry) =>
        placementCells(entry, entry.answer.length, game.value!.rows.length).includes(cell));
      activeCell.value = cell;
      direction.value = placement?.direction ?? 'across';
    }

    async function generate() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      loading.value = true;
      error.value = '';
      pending.value = null;
      showIncorrect.value = false;
      revealed.value = false;
      clearCelebrations();

      try {
        const result = await generatePuzzle(props.item.puzzle, request.signal);
        if (!result || request.signal.aborted) return;
        props.item.game = result;
        gridVersion.value += 1;
        selectInitialCell();
        message.value = 'Crossword ready. Choose a clue or start typing in the grid.';
        await nextTick();
        if (activeCell.value !== null) grid.value?.focusCell(activeCell.value, direction.value);
      } catch (problem) {
        if (!request.signal.aborted) error.value = problem instanceof Error ? problem.message : String(problem);
      } finally {
        if (!request.signal.aborted) loading.value = false;
      }
    }

    function activate(cell: number, nextDirection: Direction) {
      activeCell.value = cell;
      direction.value = nextDirection;
      showIncorrect.value = false;
    }

    function input(cell: number, letter: string) {
      if (!game.value || revealed.value) return;

      const currentGame = game.value;
      const solvedBefore = new Set(
        currentGame.placements
          .filter((placement) => placementSolved(currentGame, placement))
          .map(({ answer }) => answer),
      );
      const wasComplete = gameComplete(currentGame);

      currentGame.cells[cell] = letter;
      showIncorrect.value = false;

      for (const answer of [...celebratingAnswers.value]) {
        const placement = currentGame.placements.find((candidate) => candidate.answer === answer);
        if (!placement || !placementSolved(currentGame, placement)) stopWordCelebration(answer);
      }
      if (!letter) {
        if (!gameComplete(currentGame)) stopCompleteCelebration();
        return;
      }

      const newlySolved = currentGame.placements.filter((placement) =>
        !solvedBefore.has(placement.answer) && placementSolved(currentGame, placement));
      newlySolved.forEach((placement) => celebrateWord(placement.answer));

      const isComplete = gameComplete(currentGame);
      if (!isComplete) stopCompleteCelebration();
      if (!wasComplete && isComplete) {
        celebrateComplete();
        message.value = 'You completed the crossword! Every letter is correct.';
      } else if (newlySolved.length) {
        message.value = solvedMessage(newlySolved);
      }
    }

    function focusPlacement(placement: Placement) {
      if (!game.value) return;
      const cell = placement.row * game.value.rows.length + placement.column;
      activeCell.value = cell;
      direction.value = placement.direction;
      grid.value?.focusCell(cell, placement.direction);
      message.value = `${placement.number} ${placement.direction === 'across' ? 'Across' : 'Down'} selected.`;
    }

    function checkPuzzle() {
      if (!game.value) return;
      let blank = 0;
      let incorrect = 0;
      const size = game.value.rows.length;
      for (let cell = 0; cell < size * size; cell += 1) {
        const solution = game.value.rows[Math.floor(cell / size)][cell % size];
        if (solution === '#') continue;
        if (!game.value.cells[cell]) blank += 1;
        else if (game.value.cells[cell] !== solution) incorrect += 1;
      }
      showIncorrect.value = incorrect > 0;
      if (!blank && !incorrect) message.value = 'Everything is correct—you completed the crossword!';
      else if (incorrect) message.value = `${incorrect} incorrect ${incorrect === 1 ? 'letter' : 'letters'} highlighted. ${blank ? `${blank} cells are still blank.` : ''}`;
      else message.value = `Everything filled so far is correct. ${blank} ${blank === 1 ? 'cell is' : 'cells are'} still blank.`;
    }

    function revealCell() {
      if (!game.value || activeCell.value === null || revealed.value) return;
      const size = game.value.rows.length;
      const solution = game.value.rows[Math.floor(activeCell.value / size)][activeCell.value % size];
      if (solution === '#') return;
      game.value.cells[activeCell.value] = solution;
      showIncorrect.value = false;
      message.value = `Revealed row ${Math.floor(activeCell.value / size) + 1}, column ${activeCell.value % size + 1}.`;
      if (gameComplete(game.value)) message.value += ' That completes the crossword.';
    }

    function revealWord() {
      if (!game.value || !activePlacement.value || revealed.value) return;
      const placement = activePlacement.value;
      placementCells(placement, placement.answer.length, game.value.rows.length)
        .forEach((cell, index) => { game.value!.cells[cell] = placement.answer[index]; });
      showIncorrect.value = false;
      message.value = `Revealed ${placement.number} ${placement.direction === 'across' ? 'Across' : 'Down'}.`;
      if (gameComplete(game.value)) message.value += ' That completes the crossword.';
    }

    function giveHint() {
      if (!game.value) return;
      const remaining = game.value.placements.filter((placement) => !placementSolved(game.value!, placement));
      const preferred = activePlacement.value && !placementSolved(game.value, activePlacement.value)
        ? activePlacement.value
        : null;
      const placement = preferred ?? remaining[Math.floor(Math.random() * remaining.length)];
      if (!placement) {
        message.value = 'Every clue is already solved.';
        return;
      }

      const path = placementCells(placement, placement.answer.length, game.value.rows.length);
      const candidates = path
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell, index }) => game.value!.cells[cell] !== placement.answer[index]);
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      if (!target) return;

      activeCell.value = target.cell;
      direction.value = placement.direction;
      grid.value?.focusCell(target.cell, placement.direction);
      const size = game.value.rows.length;
      message.value = `Hint for ${placement.number} ${placement.direction === 'across' ? 'Across' : 'Down'}: row ${Math.floor(target.cell / size) + 1}, column ${target.cell % size + 1} is “${placement.answer[target.index]}”.`;
    }

    async function requestAction(action: 'new' | 'restart', event: MouseEvent) {
      actionTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      pending.value = action;
      await nextTick();
      cancelButton.value?.focus();
    }

    async function cancelAction() {
      pending.value = null;
      await nextTick();
      actionTrigger?.focus();
    }

    async function confirmAction() {
      const action = pending.value;
      pending.value = null;
      if (action === 'new') {
        await generate();
      } else if (game.value) {
        clearGame(game.value);
        revealed.value = false;
        showIncorrect.value = false;
        clearCelebrations();
        gridVersion.value += 1;
        selectInitialCell();
        message.value = 'Progress cleared. Same crossword, fresh start.';
        await nextTick();
        if (activeCell.value !== null) grid.value?.focusCell(activeCell.value, direction.value);
      }
      await nextTick();
      restartButton.value?.focus();
    }

    function clueList(title: string, placements: readonly Placement[]) {
      return h('section', { class: 'crossword-clue-section' }, [
        h('h3', title),
        h('ol', { class: 'crossword-clue-list' }, placements.map((placement) => {
          const entry = clueEntry(props.item.puzzle, placement.answer);
          const solved = solvedAnswers.value.has(placement.answer);
          const selected = activePlacement.value?.answer === placement.answer &&
            activePlacement.value.direction === placement.direction;
          return h('li', { key: `${placement.answer}-${placement.direction}` }, [
            h('button', {
              type: 'button',
              class: ['crossword-clue-button', {
                'is-solved': solved,
                'is-selected': selected,
                'is-celebrating': celebratingAnswers.value.includes(placement.answer),
              }],
              'aria-pressed': selected,
              onClick: () => focusPlacement(placement),
            }, [
              h('span', { class: 'crossword-clue-number' }, placement.number),
              h('span', { class: 'crossword-clue-text' }, entry?.clue ?? placement.answer),
              h('span', { class: 'crossword-clue-length' }, `${placement.answer.length}${solved ? ' · ✓' : ''}`),
            ]),
          ]);
        })),
      ]);
    }

    return () => {
      const puzzle = props.item.puzzle;
      return h('section', {
        class: 'crossword-game',
        style: displayStyles(props.options),
        'aria-label': 'Play crossword',
        'aria-busy': loading.value,
      }, [
        h('div', { class: 'crossword-game-toolbar' }, [
          h('p', { class: 'crossword-help' },
            `${game.value?.rows.length ?? '—'} × ${game.value?.rows.length ?? '—'} · ${puzzle.entries.length} clues`),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') }, 'Edit puzzle'),
        ]),
        puzzle.instructions ? h('p', { class: 'crossword-instructions' }, puzzle.instructions) : null,
        h('p', { id: 'crossword-play-help', class: 'crossword-help' },
          'Type letters directly into the grid. Arrow keys move through open cells. Enter, Space, or clicking an intersection switches between Across and Down. Backspace clears and moves backward when the current cell is empty.'),
        loading.value ? h('p', { role: 'status' }, 'Building your crossword…') : null,
        error.value ? h('div', { class: 'crossword-generation-error', role: 'alert' }, [
          h('p', error.value),
          h('button', { type: 'button', class: 'quiet-button', disabled: loading.value, onClick: generate }, 'Try again'),
        ]) : null,
        game.value ? h('div', {
          class: ['crossword-play-layout', { 'is-celebrating-complete': celebratingComplete.value }],
          inert: loading.value,
        }, [
          celebratingComplete.value ? h('div', {
            class: 'crossword-complete-celebration',
            'aria-hidden': 'true',
          }, [
            h('div', { class: 'crossword-complete-badge' }, 'Crossword complete!'),
            ...Array.from({ length: 24 }, (_, index) => h('span', {
              class: ['crossword-confetti-piece', { 'is-star': index % 5 === 0 }],
              style: `--confetti-left: ${4 + ((index * 17) % 92)}%; --confetti-delay: ${(index * 37) % 220}ms; --confetti-drift: ${((index % 7) - 3) * 13}px; --confetti-turn: ${index % 2 ? '-' : ''}${220 + (index % 6) * 55}deg;`,
            }, index % 5 === 0 ? '✦' : '')),
          ]) : null,
          h(PuzzleGrid, {
            ref: grid,
            key: gridVersion.value,
            game: game.value,
            options: props.options,
            activeCell: activeCell.value,
            direction: direction.value,
            revealed: revealed.value,
            showIncorrect: showIncorrect.value,
            celebratingAnswers: celebratingAnswers.value,
            onActivate: activate,
            onInput: input,
          }),
          h('aside', { class: 'crossword-clues', 'aria-label': 'Crossword clues' }, [
            h('header', { class: 'crossword-clues-header' }, [
              h('div', [
                h('h2', complete.value ? 'Nicely done!' : 'Clues'),
                h('p', `${solvedAnswers.value.size} of ${puzzle.entries.length} solved`),
              ]),
              h('progress', {
                max: puzzle.entries.length,
                value: solvedAnswers.value.size,
                'aria-label': 'Clues solved',
              }),
            ]),
            clueList('Across', across.value),
            clueList('Down', down.value),
          ]),
        ]) : null,
        h('p', { class: 'crossword-game-message', role: 'status', 'aria-live': 'polite' }, message.value),
        game.value ? h('div', { class: 'crossword-game-actions' }, [
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: loading.value || complete.value || revealed.value,
            onClick: giveHint,
          }, 'Hint'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: loading.value || revealed.value,
            onClick: checkPuzzle,
          }, 'Check puzzle'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: loading.value || activeCell.value === null || revealed.value,
            onClick: revealCell,
          }, 'Reveal cell'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: loading.value || !activePlacement.value || revealed.value,
            onClick: revealWord,
          }, 'Reveal word'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: loading.value,
            'aria-pressed': revealed.value,
            onClick: () => {
              revealed.value = !revealed.value;
              showIncorrect.value = false;
              message.value = revealed.value
                ? 'Answers shown temporarily. Hide answers to keep solving; your typed progress is unchanged.'
                : 'Answers hidden. Keep solving!';
            },
          }, revealed.value ? 'Hide answers' : 'Show answers'),
          h('button', {
            ref: restartButton,
            type: 'button',
            class: 'quiet-button',
            disabled: loading.value,
            onClick: (event: MouseEvent) => requestAction('restart', event),
          }, 'Start over'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: loading.value,
            onClick: (event: MouseEvent) => requestAction('new', event),
          }, 'New layout'),
        ]) : null,
        pending.value ? h('div', {
          class: 'crossword-restart-review',
          role: 'group',
          'aria-label': 'Confirm restart',
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelAction();
            }
          },
        }, [
          h('p', pending.value === 'new'
            ? 'Create a new crossword arrangement? Your typed progress will be cleared after the new grid is ready.'
            : 'Clear every typed letter and start this crossword again?'),
          h('div', { class: 'crossword-game-actions' }, [
            h('button', {
              ref: cancelButton,
              type: 'button',
              class: 'quiet-button',
              onClick: cancelAction,
            }, 'Cancel'),
            h('button', {
              type: 'button',
              class: 'card-primary-button',
              onClick: confirmAction,
            }, pending.value === 'new' ? 'Create new layout' : 'Start over'),
          ]),
        ]) : null,
      ]);
    };
  },
});
