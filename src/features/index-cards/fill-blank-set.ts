import type { CardSet as CardSetModel } from './tree-model.ts';
import type { Card } from './card-model.ts';
import type { ReviewOrder } from './review-setup.ts';
import type { FillBlankEditorHandle } from './fill-blank-editor.ts';
import { Icon } from '../../components/icon.ts';
import { createCard, MAX_CARDS, shuffledCardIds } from './card-model.ts';
import { CardList, type CardListHandle } from './card-list.ts';
import { FillBlankEditor } from './fill-blank-editor.ts';
import { FillBlankPaper, type FillBlankPaperHandle } from './fill-blank-paper.ts';
import { FillBlankReviewSetup } from './fill-blank-review-setup.ts';
import { ReviewResult } from './review-result.ts';
import { isFillBlankAnswerCorrect, parseFillBlankTemplate, type AnswerStrictness } from './fill-blank-model.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue';

const MIN_CARD_LIST_WIDTH = 160;
const MAX_CARD_LIST_WIDTH = 480;
const MIN_EDITOR_WIDTH = 400;
const RESULT_REVIEW_START_DELAY_MS = 420;
const RESULT_REVIEW_STEP_MS = 750;
const RESULT_REVIEW_SETTLE_MS = 620;

export const FillBlankSet = defineComponent({
  name: 'FillBlankSet',
  props: {
    set: { type: Object as PropType<CardSetModel>, required: true },
    answerStrictness: { type: Number as PropType<AnswerStrictness>, required: true },
    totalCards: { type: Number, required: true },
    cardListWidth: { type: Number as PropType<number | null>, default: null },
    tutorialReview: Boolean,
    cardListCollapsed: Boolean,
  },
  emits: { 'resize-card-list': (_width: number) => true, 'reset-card-list': () => true, 'toggle-card-list': () => true },
  setup(props, { emit, expose }) {
    const cardList = ref<CardListHandle | null>(null);
    expose({ focusCardListToggle: () => cardList.value?.focusHide() });
    const currentId = ref(props.set.cards[0]?.id ?? null);
    const reviewOrder = ref<ReviewOrder>('forward');
    const reviewSetupOpen = ref(false);
    const reviewActive = ref(false);
    const reviewNotice = ref('');
    const reviewScores = reactive(new Map<string, { correct: number; total: number }>());
    const reviewResult = ref<{ correct: number; total: number } | null>(null);
    const reviewButton = ref<HTMLButtonElement | null>(null);
    const verifyButton = ref<HTMLButtonElement | null>(null);
    const stack = ref<HTMLElement | null>(null);
    const shuffleOrder = ref<string[] | null>(null);
    const responses = ref<string[]>([]);
    const verified = ref(false);
    const reviewSide = ref<'front' | 'back'>('front');
    const editSide = ref<'front' | 'back'>('front');
    const editor = ref<FillBlankEditorHandle | null>(null);
    const reviewPaper = ref<FillBlankPaperHandle | null>(null);
    const activeBlankIndex = ref(0);
    const resultReviewIndex = ref<number | null>(null);
    let resultReviewTimer: number | undefined;
    let resultReviewNextIndex = 0;
    let resultReviewComplete = false;
    const addButton = ref<HTMLButtonElement | null>(null);
    const deleteButton = ref<HTMLButtonElement | null>(null);
    const layout = ref<HTMLElement | null>(null);
    const cardListResizing = ref(false);
    const message = ref('');
    let layoutObserver: ResizeObserver | null = null;

    const orderedCards = computed(() => {
      if (reviewOrder.value === 'backward') return [...props.set.cards].reverse();
      if (!shuffleOrder.value) return props.set.cards;
      const byId = new Map(props.set.cards.map((card) => [card.id, card]));
      return shuffleOrder.value.map((id) => byId.get(id)).filter((card): card is Card => card !== undefined);
    });
    const index = computed(() => Math.max(0, orderedCards.value.findIndex((card) => card.id === currentId.value)));
    const current = computed(() => orderedCards.value[index.value]);
    const atLimit = computed(() => props.totalCards >= MAX_CARDS);

    watch(() => props.set.cards.length, (length) => {
      if (!length && reviewActive.value) endReview();
    });
    onDeactivated(() => {
      reviewSetupOpen.value = false;
      cardListResizing.value = false;
      stopResultReview();
    });

    function maxCardListWidth() {
      const available = layout.value?.clientWidth ?? (MAX_CARD_LIST_WIDTH + MIN_EDITOR_WIDTH);
      return Math.max(MIN_CARD_LIST_WIDTH,
        Math.min(MAX_CARD_LIST_WIDTH, available - MIN_EDITOR_WIDTH));
    }
    function currentCardListWidth() {
      return props.cardListWidth ??
        layout.value?.querySelector('.card-list-panel')?.getBoundingClientRect().width ??
        224;
    }
    function setCardListWidth(width: number) {
      emit('resize-card-list',
        Math.round(Math.min(Math.max(width, MIN_CARD_LIST_WIDTH), maxCardListWidth())));
    }
    function keepCardListWidthInBounds() {
      if (props.cardListWidth !== null) setCardListWidth(props.cardListWidth);
    }
    function beginCardListResize(event: PointerEvent) {
      if (event.button !== 0) return;
      event.preventDefault();
      cardListResizing.value = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      resizeCardListFromPointer(event);
    }
    function resizeCardListFromPointer(event: PointerEvent) {
      if (!cardListResizing.value || !layout.value) return;
      const bounds = layout.value.getBoundingClientRect();
      setCardListWidth(bounds.right - event.clientX);
    }
    function endCardListResize(event: PointerEvent) {
      cardListResizing.value = false;
      if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      }
    }
    function resizeCardListFromKeyboard(event: KeyboardEvent) {
      const step = event.shiftKey ? 48 : 16;
      let width = currentCardListWidth();
      if (event.key === 'ArrowLeft') width += step;
      else if (event.key === 'ArrowRight') width -= step;
      else if (event.key === 'Home') width = MIN_CARD_LIST_WIDTH;
      else if (event.key === 'End') width = maxCardListWidth();
      else return;
      event.preventDefault();
      event.stopPropagation();
      setCardListWidth(width);
    }

    onMounted(() => {
      if (window.ResizeObserver && layout.value) {
        layoutObserver = new ResizeObserver(keepCardListWidthInBounds);
        layoutObserver.observe(layout.value);
      }
    });
    onBeforeUnmount(() => {
      layoutObserver?.disconnect();
      stopResultReview();
    });

    function stopResultReview() {
      if (resultReviewTimer !== undefined) window.clearTimeout(resultReviewTimer);
      resultReviewTimer = undefined;
      resultReviewIndex.value = null;
    }

    function scheduleResultReview(delay = RESULT_REVIEW_START_DELAY_MS) {
      if (!verified.value || reviewSide.value !== 'back' || resultReviewComplete) return;
      const count = currentTemplate().answers.length;
      if (!count || resultReviewNextIndex >= count) {
        resultReviewComplete = true;
        resultReviewIndex.value = null;
        return;
      }

      if (resultReviewTimer !== undefined) window.clearTimeout(resultReviewTimer);
      resultReviewTimer = window.setTimeout(() => {
        resultReviewTimer = undefined;
        if (!verified.value || reviewSide.value !== 'back') return;

        resultReviewIndex.value = resultReviewNextIndex;
        resultReviewNextIndex += 1;

        if (resultReviewNextIndex < count) {
          scheduleResultReview(RESULT_REVIEW_STEP_MS);
        } else {
          resultReviewTimer = window.setTimeout(() => {
            resultReviewTimer = undefined;
            resultReviewIndex.value = null;
            resultReviewComplete = true;
          }, RESULT_REVIEW_SETTLE_MS);
        }
      }, delay);
    }

    function resetAttempt() {
      stopResultReview();
      responses.value = [];
      verified.value = false;
      reviewSide.value = 'front';
      activeBlankIndex.value = 0;
      resultReviewNextIndex = 0;
      resultReviewComplete = false;
    }

    function currentTemplate() {
      return current.value ? parseFillBlankTemplate(current.value.front) : { segments: [], answers: [] };
    }

    async function focusReviewBlank(index = activeBlankIndex.value) {
      const count = currentTemplate().answers.length;
      if (!reviewActive.value || reviewSide.value !== 'front' || count === 0) return;
      activeBlankIndex.value = Math.max(0, Math.min(index, count - 1));
      await nextTick();
      reviewPaper.value?.focusBlank(activeBlankIndex.value);
    }

    async function toggleReviewSide() {
      if (!reviewActive.value) return;
      const nextSide = reviewSide.value === 'front' ? 'back' : 'front';
      if (nextSide === 'front') stopResultReview();
      reviewSide.value = nextSide;

      if (reviewSide.value === 'front' && !verified.value) {
        await focusReviewBlank();
      } else if (reviewSide.value === 'back' && verified.value && !resultReviewComplete) {
        scheduleResultReview();
      }
    }

    async function handleBlankEnter(blankIndex: number, direction: 1 | -1) {
      const count = currentTemplate().answers.length;
      if (!count || verified.value) return;

      activeBlankIndex.value = blankIndex;
      if (direction < 0) {
        await focusReviewBlank(Math.max(0, blankIndex - 1));
      } else if (blankIndex < count - 1) {
        await focusReviewBlank(blankIndex + 1);
      } else {
        verify();
      }
    }

    async function handleBlankTab(blankIndex: number, direction: 1 | -1) {
      const count = currentTemplate().answers.length;
      if (!count || verified.value) return;

      activeBlankIndex.value = blankIndex;
      if (direction < 0) {
        await focusReviewBlank(Math.max(0, blankIndex - 1));
      } else if (blankIndex < count - 1) {
        await focusReviewBlank(blankIndex + 1);
      } else {
        await nextTick();
        verifyButton.value?.focus();
      }
    }

    function resetEditSide() {
      editSide.value = 'front';
    }
    async function addCard(duplicate = false) {
      if (atLimit.value) return;
      const card = createCard(duplicate ? current.value : null);
      const sourceIndex = props.set.cards.findIndex((item) => item.id === current.value?.id);
      props.set.cards.splice(sourceIndex + 1, 0, card);
      if (shuffleOrder.value) shuffleOrder.value.splice(index.value + 1, 0, card.id);
      reviewResult.value = null;
      currentId.value = card.id;
      resetAttempt();
      resetEditSide();
      message.value = duplicate ? 'Card duplicated.' : 'New card added.';
      await nextTick();
      if (!reviewActive.value) editor.value?.focus();
    }
    async function selectCard(id: string) {
      if (reviewResult.value) reviewResult.value = null;
      currentId.value = id;
      resetAttempt();
      resetEditSide();
      message.value = '';
      if (reviewActive.value) await focusReviewBlank(0);
    }
    async function go(offset: number) {
      const card = orderedCards.value[index.value + offset];
      if (card) await selectCard(card.id);
    }

    async function startReview(order: ReviewOrder) {
      reviewScores.clear();
      reviewResult.value = null;
      reviewActive.value = true;
      reviewNotice.value = '';
      editSide.value = 'front';
      reviewOrder.value = order;
      shuffleOrder.value = order === 'shuffle' ? shuffledCardIds(props.set.cards) : null;
      currentId.value = orderedCards.value[0]?.id ?? null;
      resetAttempt();
      reviewSetupOpen.value = false;
      message.value = `Review started: ${order}.`;
      await nextTick();
      if (currentTemplate().answers.length) await focusReviewBlank(0);
      else stack.value?.focus();
    }
    function resetReviewView() {
      reviewActive.value = false;
      reviewOrder.value = 'forward';
      shuffleOrder.value = null;
      resetAttempt();
      editSide.value = 'front';
    }

    async function finishReview() {
      const cards = [...orderedCards.value];
      const total = cards.reduce((sum, card) => sum + parseFillBlankTemplate(card.front).answers.length, 0);
      const correct = cards.reduce((sum, card) => sum + (reviewScores.get(card.id)?.correct ?? 0), 0);
      reviewResult.value = { correct, total };
      resetReviewView();
      reviewNotice.value = '';
      await nextTick();
    }

    async function endReview() {
      reviewScores.clear();
      reviewResult.value = null;
      resetReviewView();
      reviewNotice.value = 'Review ended. You are back to browsing in saved order.';
      await nextTick();
      reviewButton.value?.focus();
    }

    async function dismissReviewResult() {
      reviewScores.clear();
      reviewResult.value = null;
      reviewNotice.value = 'Review finished. Keep editing, or start another review.';
      await nextTick();
      reviewButton.value?.focus();
    }

    async function reviewAgain() {
      reviewResult.value = null;
      reviewSetupOpen.value = true;
      await nextTick();
    }
    async function cancelReview() {
      reviewSetupOpen.value = false;
      await nextTick();
      reviewButton.value?.focus();
    }
    function updateResponse(blankIndex: number, value: string) {
      const next = [...responses.value];
      next[blankIndex] = value;
      responses.value = next;
      message.value = '';
    }
    function verify() {
      const card = current.value;
      if (!card || reviewSide.value !== 'front') return;
      const template = parseFillBlankTemplate(card.front);
      if (!template.answers.length) return;
      stopResultReview();
      verified.value = true;
      reviewSide.value = 'back';
      const correct = template.answers.filter((answer, blankIndex) =>
        isFillBlankAnswerCorrect(answer, responses.value[blankIndex] ?? '', props.answerStrictness)).length;
      reviewScores.set(card.id, { correct, total: template.answers.length });
      resultReviewNextIndex = 0;
      resultReviewComplete = false;
      scheduleResultReview();
      message.value = `${correct} of ${template.answers.length} ${template.answers.length === 1 ? 'blank' : 'blanks'} correct.`;
    }

    async function deleteCurrentCard() {
      if (!current.value) return;
      const id = current.value.id;
      const position = orderedCards.value.findIndex((card) => card.id === id);
      const next = orderedCards.value[position + 1] ?? orderedCards.value[position - 1];
      const savedIndex = props.set.cards.findIndex((card) => card.id === id);
      if (savedIndex >= 0) props.set.cards.splice(savedIndex, 1);
      reviewScores.delete(id);
      if (shuffleOrder.value) shuffleOrder.value = shuffleOrder.value.filter((cardId) => cardId !== id);
      currentId.value = next?.id ?? null;
      resetAttempt();
      resetEditSide();
      message.value = 'Card deleted.';
      await nextTick();
      if (reviewActive.value && current.value) await focusReviewBlank(0);
      else (current.value ? deleteButton.value : addButton.value)?.focus();
    }

    function preserveEditorSelection(event: MouseEvent) {
      event.preventDefault();
    }
    function shortcuts(event: KeyboardEvent) {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target instanceof Element ? event.target : null;
      const typing = Boolean(target?.closest('[contenteditable], input, select, textarea'));

      if (typing) return;
      if (target?.closest('button, a, dialog, summary')) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'ArrowRight') {
        const blanks = currentTemplate().answers.length;
        if (!reviewActive.value || verified.value || blanks === 0) {
          event.preventDefault();
          go(1);
        }
      } else if (event.key === ' ') {
        event.preventDefault();
        if (!reviewActive.value) {
          editSide.value = editSide.value === 'front' ? 'back' : 'front';
        } else {
          void toggleReviewSide();
        }
      } else if (event.key === 'Enter' && reviewActive.value && !verified.value &&
          reviewSide.value === 'front' && currentTemplate().answers.length) {
        event.preventDefault();
        verify();
      }
    }

    return () => {
      const card = current.value;
      const template = card ? parseFillBlankTemplate(card.front) : { segments: [], answers: [] };
      const blankCount = template.answers.length;
      const correctCount = verified.value
        ? template.answers.filter((answer, blankIndex) =>
          isFillBlankAnswerCorrect(answer, responses.value[blankIndex] ?? '', props.answerStrictness)).length
        : 0;
      const position = `Card ${index.value + 1} of ${orderedCards.value.length}`;
      const lastCard = index.value === orderedCards.value.length - 1;
      const canAdvance = verified.value || blankCount === 0;
      const orderDescription = reviewOrder.value === 'shuffle' ? 'Shuffled'
        : reviewOrder.value === 'backward' ? 'Last to first' : 'First to last';

      return h('div', {
        ref: layout,
        class: ['card-set-layout', 'fill-blank-set-layout', { 'card-list-resizing': cardListResizing.value, 'card-list-collapsed': props.cardListCollapsed }],
        style: props.cardListWidth === null ? null : { '--card-list-width': `${props.cardListWidth}px` },
        onKeydown: shortcuts,
      }, [
        h('div', { class: 'card-set fill-blank-set' }, [
          !reviewResult.value && card ? h('section', { class: 'card-review-session', 'aria-label': 'Review status' }, [
            h('div', { class: 'card-review-session-copy' }, [
              h('strong', reviewActive.value ? 'Fill-in review' : 'Browse & edit'),
              h('p', { role: 'status' }, reviewActive.value
                ? `${position} · ${blankCount} ${blankCount === 1 ? 'blank' : 'blanks'} · ${orderDescription}`
                : `${position} · ${blankCount} ${blankCount === 1 ? 'blank' : 'blanks'}`),
            ]),
            h('div', { class: 'card-review-session-actions' }, [
              h('button', {
                ref: reviewButton, type: 'button', class: 'quiet-button card-review-button',
                'aria-haspopup': 'dialog', onClick: () => { reviewSetupOpen.value = true; },
              }, reviewActive.value ? 'Change setup' : 'Review'),
              reviewActive.value ? h('button', {
                type: 'button', class: 'quiet-button', 'aria-label': 'End review',
                onClick: endReview,
              }, 'End review') : null,
            ]),
          ]) : null,
          reviewResult.value ? h(ReviewResult, {
            correct: reviewResult.value.correct,
            total: reviewResult.value.total,
            summary: reviewResult.value.total
              ? `${reviewResult.value.correct} of ${reviewResult.value.total} blanks correct. Unverified or unanswered blanks count as missed.`
              : 'No scored blanks were available in this review.',
            onDone: dismissReviewResult,
            onReviewAgain: reviewAgain,
          }) : card ? h('div', {
            ref: stack,
            class: ['ruled-card-stack', {
              'has-second-card': props.set.cards.length > 1,
              'has-third-card': props.set.cards.length > 2,
            }],
            tabindex: reviewActive.value ? 0 : -1,
            role: 'group',
            'aria-label': reviewActive.value
              ? `Card ${index.value + 1} of ${orderedCards.value.length}. Answer what you can, then verify.`
              : `Card ${index.value + 1} of ${orderedCards.value.length}. Select text and use the blank controls below the card.`,
          }, [
            reviewActive.value
              ? h(FillBlankPaper, {
                key: `review-${card.id}`,
                ref: reviewPaper,
                card,
                position: index.value + 1,
                responses: responses.value,
                answerStrictness: props.answerStrictness,
                verified: verified.value,
                side: reviewSide.value,
                resultReviewIndex: resultReviewIndex.value,
                onUpdateResponse: updateResponse,
                onBlankFocus: (blankIndex: number) => { activeBlankIndex.value = blankIndex; },
                onBlankEnter: handleBlankEnter,
                onBlankTab: handleBlankTab,
              })
              : h(FillBlankEditor, {
                key: `edit-${card.id}`,
                ref: editor,
                card,
                position: index.value + 1,
                side: editSide.value,
                onMessage: (value: string) => { message.value = value; },
              }),
          ]) : h('div', { class: 'card-set-empty' }, [
            h(Icon, { name: 'cards' }),
            h('h3', 'A fresh fill-in set.'),
            h('p', 'Add a card, write the prompt, then select the words learners should recall.'),
            h('button', {
              ref: addButton, type: 'button', class: 'card-primary-button',
              disabled: atLimit.value, onClick: () => addCard(),
            }, [h(Icon, { name: 'plus' }), 'Add first card']),
          ]),
          !reviewResult.value && card ? h('div', { class: 'card-controls' }, [
            h('div', {
              class: ['card-review-controls', {
                'fill-blank-edit-controls': !reviewActive.value,
                'fill-blank-review-pending-controls': reviewActive.value && !verified.value,
              }],
              'aria-label': reviewActive.value ? 'Fill in the blanks review' : 'Browse cards',
            }, [
              h('button', {
                type: 'button', class: 'quiet-button card-previous',
                title: 'Previous card', 'aria-label': 'Previous card',
                disabled: index.value === 0, onClick: () => go(-1),
              }, [h(Icon, { name: 'chevron' }), 'Previous']),
              ...(reviewActive.value
                ? [
                  verified.value
                    ? h('button', {
                      type: 'button',
                      class: 'card-flip-button',
                      'aria-label': `Flip to ${reviewSide.value === 'front' ? 'back' : 'front'}`,
                      onClick: toggleReviewSide,
                    }, [h(Icon, { name: 'flip' }), reviewSide.value === 'front' ? 'Show back' : 'Show front'])
                    : [
                      h('button', {
                        type: 'button',
                        class: 'card-flip-button',
                        'aria-label': `Flip to ${reviewSide.value === 'front' ? 'back' : 'front'}`,
                        onClick: toggleReviewSide,
                      }, [h(Icon, { name: 'flip' }), reviewSide.value === 'front' ? 'Show back' : 'Show front']),
                      h('button', {
                        ref: verifyButton,
                        type: 'button',
                        class: 'card-primary-button fill-blank-verify-button',
                        disabled: blankCount === 0 || reviewSide.value === 'back',
                        title: reviewSide.value === 'back' ? 'Return to the prompt to verify' : undefined,
                        onKeydown: (event: KeyboardEvent) => {
                          if (event.key !== 'Tab' || !event.shiftKey || reviewSide.value !== 'front') return;
                          event.preventDefault();
                          void focusReviewBlank(blankCount - 1);
                        },
                        onClick: verify,
                      }, [h(Icon, { name: 'checklist' }), 'Verify']),
                    ],
                ]
                : [
                  h('button', {
                    type: 'button',
                    class: 'fill-blank-segment-button',
                    title: 'Make blank',
                    'aria-label': 'Make blank from selected text',
                    disabled: editSide.value === 'back',
                    onMousedown: preserveEditorSelection,
                    onClick: () => editor.value?.makeBlank(),
                  }, [h(Icon, { name: 'blank-add' })]),
                  h('button', {
                    type: 'button',
                    class: 'fill-blank-segment-button',
                    title: 'Remove blank',
                    'aria-label': 'Remove blank at the cursor',
                    disabled: editSide.value === 'back',
                    onMousedown: preserveEditorSelection,
                    onClick: () => editor.value?.removeBlank(),
                  }, [h(Icon, { name: 'blank-remove' })]),
                  h('button', {
                    type: 'button',
                    class: 'card-flip-button',
                    'aria-label': `Flip to ${editSide.value === 'front' ? 'back' : 'front'}`,
                    onClick: () => { editSide.value = editSide.value === 'front' ? 'back' : 'front'; },
                  }, [h(Icon, { name: 'flip' }), editSide.value === 'front' ? 'Show back' : 'Show front']),
                ]),
              h('button', {
                type: 'button', class: 'quiet-button',
                disabled: reviewActive.value ? !canAdvance : lastCard,
                onClick: () => reviewActive.value && lastCard ? finishReview() : go(1),
              }, reviewActive.value && lastCard && canAdvance
                ? 'Finish review'
                : reviewActive.value && blankCount === 0
                  ? 'Skip'
                  : ['Next card', h(Icon, { name: 'chevron' })]),
            ]),
            reviewActive.value || message.value
              ? h('p', { class: 'card-review-instruction fill-blank-authoring-hint' },
                reviewActive.value
                  ? blankCount === 0
                    ? 'No blanks are defined on this card. End review to edit it, or skip to the next card.'
                    : verified.value
                      ? `${correctCount} of ${blankCount} correct. Correct answers are green; missed answers appear below them in red.`
                      : reviewSide.value === 'back'
                        ? 'Answer key shown. Flip back to continue answering; your responses are preserved.'
                        : 'Enter moves through blanks and verifies on the last. Tab moves through blanks, then to Verify. Unanswered or unverified blanks count as missed in your final score.'
                  : message.value)
              : null,
            !reviewActive.value ? h('div', { class: 'card-edit-controls', 'aria-label': 'Card actions' }, [
              h('button', {
                ref: addButton, type: 'button', class: 'quiet-button',
                disabled: atLimit.value, onClick: () => addCard(),
              }, [h(Icon, { name: 'plus' }), 'New card']),
              h('button', {
                type: 'button', class: 'quiet-button',
                disabled: atLimit.value, onClick: () => addCard(true),
              }, [h(Icon, { name: 'duplicate' }), 'Duplicate']),
              h('button', {
                ref: deleteButton, type: 'button', class: 'icon-button delete-button',
                title: 'Delete card', 'aria-label': 'Delete card', onClick: deleteCurrentCard,
              }, [h(Icon, { name: 'trash' })]),
            ]) : null,
          ]) : null,
          atLimit.value ? h('p', { class: 'card-limit-message', role: 'status' },
            `Workspace limit reached: ${MAX_CARDS} cards.`) : null,
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
          reviewSetupOpen.value ? h(FillBlankReviewSetup, {
            initialOrder: reviewOrder.value,
            cardCount: props.set.cards.length,
            modal: !props.tutorialReview,
            onCancel: cancelReview, onStart: startReview,
          }) : null,
        ]),
        !props.cardListCollapsed ? h('div', {
          class: 'card-list-resizer', role: 'separator', tabindex: 0,
          'aria-label': 'Resize Cards panel', 'aria-orientation': 'vertical',
          'aria-valuemin': MIN_CARD_LIST_WIDTH, 'aria-valuemax': maxCardListWidth(),
          'aria-valuenow': Math.round(currentCardListWidth()),
          onPointerdown: beginCardListResize, onPointermove: resizeCardListFromPointer,
          onPointerup: endCardListResize, onPointercancel: endCardListResize,
          onKeydown: resizeCardListFromKeyboard, onDblclick: () => emit('reset-card-list'),
        }) : null,
        h(CardList, {
          ref: cardList, hidden: props.cardListCollapsed,
          onHide: () => { cardListResizing.value = false; emit('toggle-card-list'); },
          cards: orderedCards.value, selectedId: card?.id ?? null,
          atLimit: atLimit.value, previewSide: 'front', maskBlanks: true,
          orderLabel: reviewActive.value ? `${orderDescription} · fill in the blanks` : 'Saved order',
          onSelect: selectCard, onAdd: () => addCard(),
        }),
      ]);
    };
  },
});
