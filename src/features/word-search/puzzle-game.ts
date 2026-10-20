import { useStatistics } from '../../components/statistics-context.ts';
import type { ConfiguredWordSearch, BoardRotation } from './library-model.ts';
import type { DisplayOptions } from './display-options.ts';
import type { PuzzleGridHandle, SelectionAttempt, WordCelebration } from './puzzle-grid.ts';
import { DIFFICULTIES } from './puzzle-model.ts';
import { boardScore, hasCompletedBoard, isFinishedGame, lineCells, matchSelection, wordOnLine, wordScore } from './game-model.ts';
import { generatePuzzle } from './puzzle-generator.ts';
import { PuzzleGrid } from './puzzle-grid.ts';
import { Icon } from '../../components/icon.ts';
import { defaultDisplayOptions, displayStyles } from './display-options.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

export const PuzzleGame = defineComponent({
  name: 'PuzzleGame',
  props: {
    item: { type: Object as PropType<ConfiguredWordSearch>, required: true },
    options: { type: Object as PropType<DisplayOptions>, default: defaultDisplayOptions },
  },
  emits: { 'edit': () => true },
  setup(props, { emit }) {
    const loading = ref(false);
    const error = ref('');
    const message = ref('');
    const revealed = ref(false);
    const hint = ref<number | null>(null);
    const pending = ref<'new' | 'restart' | 'give-up' | null>(null);
    const viewingBoard = ref(false);
    const grid = ref<PuzzleGridHandle | null>(null);
    const gridVersion = ref(0);
    const attempt = ref<SelectionAttempt | null>(null);
    const celebration = ref<WordCelebration | null>(null);
    const boardTurns = ref((props.item.boardRotation ?? 0) / 90);
    const rotating = ref(false);
    let attemptTimer: number | undefined;
    let celebrationTimer: number | undefined;
    let rotationTimer: number | undefined;
    let attemptId = 0;
    let celebrationId = 0;
    function clearAttempt() {
      clearTimeout(attemptTimer);
      attempt.value = null;
    }
    function clearCelebration() {
      clearTimeout(celebrationTimer);
      celebration.value = null;
    }
    const restartButton = ref<HTMLButtonElement | null>(null);
    const cancelButton = ref<HTMLButtonElement | null>(null);
    let controller: AbortController | null = null;
    let actionTrigger: HTMLElement | null = null;
    const game = computed(() => props.item.game);
    // Include legacy assisted finds so their answers remain revealed when replaying an older saved board.
    const revealedAnswers = computed(() => new Set([
      ...(game.value?.revealedAnswers ?? []),
      ...(game.value?.found.filter(({ revealed }) => revealed).map(({ word }) => word) ?? []),
    ]));
    const activeWords = computed(() => game.value?.selectedWords ?? props.item.puzzle.words);
    const foundWords = computed(() => new Set(game.value?.found.map(({ word }) => word) ?? []));
    const hintMode = computed(() => (props.item.puzzle.studyMode ?? 'words') === 'hints');
    const complete = computed(() => Boolean(game.value) && foundWords.value.size === activeWords.value.length);
    const finished = computed(() => isFinishedGame(game.value));
    const score = computed(() => game.value ? boardScore(game.value) : { earned: 0, possible: 0 });
    const showCompletionOverlay = computed(() =>
      finished.value && !celebration.value?.complete && !viewingBoard.value);
    const statistics = useStatistics();
    let completionRecorded = complete.value;
    watch(complete, value => {
      if (value && !completionRecorded) {
        completionRecorded = true;
        statistics?.record('word-search', props.item.id, 'gamesCompleted');
      }
    }, { flush: 'sync' });
    onBeforeUnmount(() => {
      controller?.abort();
      clearAttempt();
      clearCelebration();
      clearTimeout(rotationTimer);
    });
    onDeactivated(() => {
      pending.value = null;
      viewingBoard.value = false;
      revealed.value = false;
      hint.value = null;
      clearAttempt();
      clearCelebration();
    });
    onMounted(() => { if (!game.value) generate(); });

    async function generate() {
      clearAttempt();
      clearCelebration();
      controller?.abort();
      const request = new AbortController();
      controller = request;
      loading.value = true;
      error.value = '';
      pending.value = null;
      viewingBoard.value = false;
      try {
        const result = await generatePuzzle(props.item.puzzle, request.signal);
        if (!result || request.signal.aborted) return;
        completionRecorded = false;
        statistics?.record('word-search', props.item.id, 'gamesStarted');
        props.item.game = result;
        gridVersion.value += 1;
        revealed.value = false;
        hint.value = null;
        message.value = hintMode.value
          ? 'Puzzle ready. Use the clues to find every hidden answer.'
          : 'Puzzle ready. Find every word in the list.';
      } catch (problem) {
        if (!request.signal.aborted) error.value = problem instanceof Error ? problem.message : String(problem);
      } finally {
        if (!request.signal.aborted) loading.value = false;
      }
    }

    function select(start: number, end: number) {
      if (!game.value || loading.value || revealed.value || finished.value) return;
      statistics?.record('word-search', props.item.id, 'wordAttempts');
      const match = matchSelection(props.item.puzzle, game.value, start, end);
      const cells = lineCells(start, end, props.item.puzzle.size);
      const text = wordOnLine(game.value.rows, start, end);
      const assisted = Boolean(match && hintMode.value && revealedAnswers.value.has(match.word));
      clearAttempt();
      attempt.value = {
        id: ++attemptId,
        start,
        end,
        cells: cells.length ? cells : [start, end],
        matched: Boolean(match),
        revealed: assisted,
      };
      attemptTimer = setTimeout(clearAttempt, match ? 230 : 2250);
      const recognized = text ? `Selected “${text}”. ` : '';
      if (!match) {
        message.value = text ? `${recognized}No matching word. Try again.`
          : 'Those endpoints do not form a straight line. No letter sequence was recognized.';
        return;
      }
      if (foundWords.value.has(match.word)) { message.value = `${recognized}${match.word} is already found.`; return; }
      statistics?.record('word-search', props.item.id, 'wordsSolved');
      game.value.found.push(assisted ? { ...match, revealed: true } : match);
      hint.value = null;
      const completed = game.value.found.length === activeWords.value.length;
      if (completed) game.value.completed = true;
      clearCelebration();
      celebration.value = {
        id: ++celebrationId,
        start: match.start,
        end: match.end,
        complete: completed,
        revealed: assisted,
      };
      celebrationTimer = setTimeout(clearCelebration, completed ? 2100 : 1050);
      message.value = recognized + (completed ? `You found ${match.word}—and completed the puzzle!` : `Found ${match.word}!`);
    }

    function giveHint() {
      if (!game.value || finished.value) return;
      const remaining = game.value.placements.filter(({ word }) => !foundWords.value.has(word));
      const placement = remaining[Math.floor(Math.random() * remaining.length)];
      if (!placement) return;
      hint.value = placement.start;
      grid.value?.focusCell(placement.start);
      message.value = hintMode.value
        ? `A remaining answer starts at row ${Math.floor(placement.start / props.item.puzzle.size) + 1}, column ${placement.start % props.item.puzzle.size + 1}.`
        : `${placement.word} starts at row ${Math.floor(placement.start / props.item.puzzle.size) + 1}, column ${placement.start % props.item.puzzle.size + 1}.`;
    }

    function revealWord(word: string) {
      if (!game.value || finished.value || !hintMode.value ||
          foundWords.value.has(word) || revealedAnswers.value.has(word)) return;
      game.value.revealedAnswers = [...(game.value.revealedAnswers ?? []), word];
      message.value = `Answer revealed: ${word}. It will stay visible until you generate a new layout.`;
    }

    function rotateBoard() {
      if (rotating.value || loading.value) return;
      clearAttempt();
      clearCelebration();
      grid.value?.cancelSelection();
      boardTurns.value += 1;
      props.item.boardRotation = (((boardTurns.value % 4) + 4) % 4 * 90) as BoardRotation;
      rotating.value = true;
      clearTimeout(rotationTimer);
      rotationTimer = setTimeout(() => {
        rotating.value = false;
      }, 820);
      message.value = `Board rotated to ${props.item.boardRotation}°.`;
    }

    async function requestAction(action: 'new' | 'restart' | 'give-up', event: MouseEvent) {
      actionTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      pending.value = action;
      await nextTick();
      if (finished.value) grid.value?.focusCompletionCancel();
      else cancelButton.value?.focus();
    }

    async function cancelAction() {
      pending.value = null;
      await nextTick();
      actionTrigger?.focus();
    }

    async function confirmAction() {
      clearAttempt();
      clearCelebration();
      const action = pending.value;
      pending.value = null;
      if (action === 'new') await generate();
      else if (action === 'give-up' && game.value && !finished.value) {
        game.value.gaveUp = true;
        hint.value = null;
        viewingBoard.value = false;
        message.value = `You gave up. Final score: ${score.value.earned} / ${score.value.possible}.`;
      } else if (action === 'restart' && game.value) {
        // An older completed save may lack the optional flag. Keep its achievement
        // when restarting the same layout, even though found words are cleared.
        if (hasCompletedBoard(game.value)) game.value.completed = true;
        completionRecorded = false;
        statistics?.record('word-search', props.item.id, 'gamesStarted');
        // Preserve revealed clues from this layout, including legacy assisted finds.
        if (revealedAnswers.value.size) game.value.revealedAnswers = [...revealedAnswers.value];
        game.value.found = [];
        delete game.value.gaveUp;
        viewingBoard.value = false;
        revealed.value = false;
        hint.value = null;
        gridVersion.value += 1;
        message.value = 'Progress cleared. Same puzzle, fresh start.';
      }
      await nextTick();
      if (finished.value) grid.value?.focusCompletionAction();
      else restartButton.value?.focus();
    }

    return () => {
      const puzzle = props.item.puzzle;
      const difficulty = DIFFICULTIES.find(({ value }) => value === puzzle.difficulty);
      return h('section', {
        class: 'word-search-game', style: displayStyles(props.options),
        'aria-label': 'Play word search', 'aria-busy': loading.value,
      }, [
        h('div', { class: 'word-search-game-toolbar' }, [
          h('p', { class: 'word-search-help' }, `${puzzle.size} × ${puzzle.size} · ${difficulty?.label} · ${difficulty?.description}${game.value?.selectedWords ? ` · ${activeWords.value.length} of ${puzzle.words.length} pool words` : ''}`),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') }, 'Edit puzzle'),
        ]),
        puzzle.instructions ? h('p', { class: 'word-search-instructions' }, puzzle.instructions) : null,
        h('p', { id: 'word-search-play-help', class: 'word-search-help' },
          'Drag across a word with a mouse, or tap its first and last letters. Select either end first. Keyboard: use arrow keys to move, Enter or Space to choose each end, and Escape to cancel. Scroll sideways for larger grids.'),
        loading.value ? h('p', { role: 'status' }, 'Arranging your words…') : null,
        error.value ? h('div', { class: 'word-search-generation-error', role: 'alert' }, [
          h('p', error.value),
          h('button', { type: 'button', class: 'quiet-button', disabled: loading.value, onClick: generate }, 'Try again'),
        ]) : null,
        game.value ? h('div', { class: 'word-search-play-layout', inert: loading.value }, [
          h(PuzzleGrid, {
            ref: grid, key: gridVersion.value, game: game.value,
            revealed: revealed.value || game.value.gaveUp === true, hint: hint.value, onSelect: select,
            options: props.options,
            attempt: attempt.value,
            celebration: celebration.value,
            covered: showCompletionOverlay.value,
            finished: finished.value && !celebration.value?.complete,
            score: score.value,
            viewingBoard: viewingBoard.value,
            pendingAction: finished.value ? (pending.value === 'give-up' ? null : pending.value) : null,
            onViewBoard: async () => {
              viewingBoard.value = true;
              pending.value = null;
              await nextTick();
              grid.value?.focusViewButton();
            },
            onViewResults: async () => {
              viewingBoard.value = false;
              pending.value = null;
              await nextTick();
              grid.value?.focusViewButton();
            },
            onRestart: (event: MouseEvent) => requestAction('restart', event),
            onNewLayout: (event: MouseEvent) => requestAction('new', event),
            onCancelAction: cancelAction,
            onConfirmAction: confirmAction,
            rotationTurns: boardTurns.value,
            rotating: rotating.value,
          }),
          h('aside', {
            class: ['word-search-word-bank', { 'uses-hints': hintMode.value }],
            'aria-label': hintMode.value ? 'Clues' : 'Words to find',
          }, hintMode.value ? [
            h('header', { class: 'word-search-clue-header' }, [
              h('div', {}, [
                h('h3', finished.value ? game.value?.gaveUp ? 'Board ended' : 'Nicely done!' : 'Clues'),
                h('p', { class: 'word-search-clue-progress' },
                  `${foundWords.value.size} of ${activeWords.value.length} found · ${score.value.earned} points`),
              ]),
              h('progress', {
                max: activeWords.value.length,
                value: foundWords.value.size,
                'aria-label': 'Words found',
              }),
            ]),
            h('ol', { class: 'word-search-clue-list' }, activeWords.value.map((word, index) => {
              const found = foundWords.value.has(word);
              const assisted = Boolean(game.value?.found.some((entry) => entry.word === word && entry.revealed));
              const individuallyRevealed = revealedAnswers.value.has(word);
              const answerVisible = revealed.value || game.value?.gaveUp === true || found || individuallyRevealed;
              const location = (revealed.value || finished.value)
                ? game.value?.placements.find((entry) => entry.word === word) : null;
              const points = game.value ? wordScore(game.value, word) : 0;
              return h('li', {
                key: word,
                class: ['word-search-clue', {
                  'is-found': found,
                  'is-revealed-found': assisted,
                  'is-answer-revealed': individuallyRevealed,
                }],
              }, [
                h('span', { class: 'word-search-clue-number', 'aria-hidden': 'true' }, index + 1),
                h('div', { class: 'word-search-clue-content' }, [
                  h('p', { class: 'word-search-clue-text' }, puzzle.hints?.[word]),
                  answerVisible ? h('p', { class: 'word-search-revealed-word' }, word) : null,
                  location ? h('p', { class: 'word-search-answer-location' },
                    `Row ${Math.floor(location.start / puzzle.size) + 1}, column ${location.start % puzzle.size + 1} → row ${Math.floor(location.end / puzzle.size) + 1}, column ${location.end % puzzle.size + 1}`) : null,
                  h('div', { class: 'word-search-clue-footer' }, [
                    h('span', { class: 'word-search-word-state' },
                      found ? (assisted ? '✓ Found · answer revealed' : '✓ Found')
                        : individuallyRevealed ? 'Answer revealed' : 'Not found'),
                    (finished.value || found || individuallyRevealed)
                      ? h('span', { class: 'word-search-word-points',
                        'aria-label': `${points} points` }, `+${points}`) : null,
                    !found && !finished.value && !revealed.value && !individuallyRevealed ? h('button', {
                      type: 'button',
                      class: 'word-search-word-reveal',
                      onClick: () => revealWord(word),
                    }, 'Reveal answer') : null,
                  ]),
                ]),
              ]);
            })),
          ] : [
            h('h3', finished.value ? game.value?.gaveUp ? 'Board ended' : 'Nicely done!' : 'Words to find'),
            h('p', { class: 'word-search-progress' },
              `${foundWords.value.size} of ${activeWords.value.length} found · ${score.value.earned} points`),
            h('progress', { max: activeWords.value.length, value: foundWords.value.size, 'aria-label': 'Words found' }),
            h('ul', {}, activeWords.value.map((word) => {
              const found = foundWords.value.has(word);
              const location = (revealed.value || finished.value)
                ? game.value?.placements.find((entry) => entry.word === word) : null;
              const points = game.value ? wordScore(game.value, word) : 0;
              return h('li', {
                key: word, class: { 'is-found': found },
              }, [
                h('span', { class: 'word-search-answer-text' }, word),
                h('span', { class: 'word-search-word-state' }, [
                  found ? '✓ Found' : game.value?.gaveUp ? 'Not found' : 'To find',
                  (finished.value || found)
                    ? h('span', { class: 'word-search-word-points',
                      'aria-label': `${points} points` }, ` +${points}`) : null,
                ]),
                location ? h('span', { class: 'word-search-answer-location' },
                  `Row ${Math.floor(location.start / puzzle.size) + 1}, column ${location.start % puzzle.size + 1} → row ${Math.floor(location.end / puzzle.size) + 1}, column ${location.end % puzzle.size + 1}`) : null,
              ]);
            })),
          ]),
        ]) : null,
        h('p', { class: 'word-search-game-message', role: 'status', 'aria-live': 'polite' }, message.value),
        game.value && !finished.value ? h('div', { class: 'word-search-game-actions' }, [
          h('button', {
            type: 'button',
            class: ['quiet-button', 'word-search-rotate-button', { 'is-rotating': rotating.value }],
            disabled: loading.value || rotating.value,
            title: 'Rotate board 90° clockwise',
            onClick: rotateBoard,
          }, [
            h(Icon, { name: 'rotate' }),
            h('span', 'Rotate board'),
            h('span', { class: 'word-search-rotation-angle', 'aria-hidden': 'true' },
              `${props.item.boardRotation ?? 0}°`),
          ]),
          h('button', {
            type: 'button', class: 'quiet-button', disabled: loading.value || complete.value || revealed.value,
            onClick: giveHint,
          }, 'Hint'),
          h('button', {
            type: 'button', class: 'quiet-button', disabled: loading.value, 'aria-pressed': revealed.value,
            onClick: () => {
              revealed.value = !revealed.value;
              hint.value = null;
              message.value = revealed.value ? 'Answers shown. Hide answers to keep playing; your progress is unchanged.' : 'Answers hidden. Keep searching!';
            },
          }, revealed.value ? 'Hide answers' : 'Show answers'),
          h('button', {
            type: 'button', class: 'quiet-button word-search-give-up-button',
            disabled: loading.value,
            onClick: (event: MouseEvent) => requestAction('give-up', event),
          }, 'Give up'),
          h('button', {
            ref: restartButton, type: 'button', class: 'quiet-button', disabled: loading.value,
            onClick: (event: MouseEvent) => requestAction('restart', event),
          }, 'Start over'),
          h('button', {
            type: 'button', class: 'quiet-button', disabled: loading.value,
            onClick: (event: MouseEvent) => requestAction('new', event),
          }, 'New layout'),
        ]) : null,
        pending.value && !finished.value ? h('div', {
          class: 'word-search-restart-review', role: 'group',
          'aria-label': pending.value === 'give-up' ? 'Confirm giving up' : 'Confirm puzzle reset',
          onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); cancelAction(); } },
        }, [
          h('p', pending.value === 'new'
            ? 'Create a new arrangement? Your current progress will be cleared once the new grid is ready.'
            : pending.value === 'give-up'
              ? 'Give up and end this board? Unfound answers will be shown and the score finalized. You can start over afterward.'
              : 'Clear your found words and start this grid again?'),
          h('div', { class: 'word-search-game-actions' }, [
            h('button', { ref: cancelButton, type: 'button', class: 'quiet-button', onClick: cancelAction }, 'Cancel'),
            h('button', { type: 'button', class: 'card-primary-button', onClick: confirmAction },
              pending.value === 'new' ? 'Create new layout' : pending.value === 'give-up' ? 'Give up' : 'Start over'),
          ]),
        ]) : null,
      ]);
    };
  },
});
