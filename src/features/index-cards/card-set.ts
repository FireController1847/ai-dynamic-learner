import type { CardSet as CardSetModel } from './tree-model.ts';
import type { Card, CardSide } from './card-model.ts';
import type { ReviewOrder, ReviewSettings } from './review-setup.ts';
import type { FocusHandle } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { createCard, MAX_CARDS, MAX_CARD_TEXT_LENGTH, shuffledCardIds } from './card-model.ts';
import { CardList, type CardListHandle } from './card-list.ts';
import { CardPaper } from './card-paper.ts';
import { ReviewSetup } from './review-setup.ts';
import { ReviewResult } from './review-result.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue';

const MIN_CARD_LIST_WIDTH = 160;
const MAX_CARD_LIST_WIDTH = 480;
const MIN_EDITOR_WIDTH = 400;

export const CardSet = defineComponent({
  name: 'CardSet',
  props: {
    set: { type: Object as PropType<CardSetModel>, required: true },
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
    const side = ref<CardSide>('front');
    const reviewSide = ref<CardSide>('front');
    const reviewOrder = ref<ReviewOrder>('forward');
    const reviewSetupOpen = ref(false);
    const reviewActive = ref(false);
    const reviewNotice = ref('');
    const reviewGrades = reactive(new Map<string, boolean>());
    const reviewResult = ref<{ correct: number; total: number } | null>(null);
    const reviewButton = ref<HTMLButtonElement | null>(null);
    const stack = ref<HTMLElement | null>(null);
    const shuffleOrder = ref<string[] | null>(null);
    const editor = ref<FocusHandle | null>(null);
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
    onBeforeUnmount(() => layoutObserver?.disconnect());

    async function addCard(duplicate = false) {
      if (atLimit.value) return;
      const card = createCard(duplicate ? current.value : null);
      const sourceIndex = props.set.cards.findIndex((item) => item.id === current.value?.id);
      props.set.cards.splice(sourceIndex + 1, 0, card);
      if (shuffleOrder.value) shuffleOrder.value.splice(index.value + 1, 0, card.id);
      reviewResult.value = null;
      currentId.value = card.id;
      side.value = reviewSide.value;
      message.value = duplicate ? 'Card duplicated.' : 'New card added.';
      await nextTick();
      editor.value?.focus();
    }

    function go(offset: number) {
      const card = orderedCards.value[index.value + offset];
      if (!card) return;
      selectCard(card.id);
    }

    function selectCard(id: string) {
      if (reviewResult.value) reviewResult.value = null;
      currentId.value = id;
      side.value = reviewSide.value;
      message.value = '';
    }

    function flip() {
      if (current.value) side.value = side.value === 'front' ? 'back' : 'front';
    }

    async function startReview(settings: ReviewSettings) {
      reviewGrades.clear();
      reviewResult.value = null;
      reviewActive.value = true;
      reviewNotice.value = '';
      reviewSide.value = settings.side;
      reviewOrder.value = settings.order;
      shuffleOrder.value = settings.order === 'shuffle' ? shuffledCardIds(props.set.cards) : null;
      currentId.value = orderedCards.value[0]?.id ?? null;
      side.value = reviewSide.value;
      reviewSetupOpen.value = false;
      message.value = `Review started: ${settings.side} first, ${settings.order}.`;
      await nextTick();
      stack.value?.focus();
    }

    function resetReviewView() {
      reviewActive.value = false;
      reviewOrder.value = 'forward';
      reviewSide.value = 'front';
      shuffleOrder.value = null;
      side.value = 'front';
    }

    async function finishReview() {
      const cards = [...orderedCards.value];
      reviewResult.value = {
        correct: cards.filter((card) => reviewGrades.get(card.id) === true).length,
        total: cards.length,
      };
      resetReviewView();
      reviewNotice.value = '';
      await nextTick();
    }

    async function endReview() {
      reviewGrades.clear();
      reviewResult.value = null;
      resetReviewView();
      reviewNotice.value = 'Review ended. You are back to browsing in saved order.';
      await nextTick();
      reviewButton.value?.focus();
    }

    async function dismissReviewResult() {
      reviewGrades.clear();
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

    function gradeCurrent(correct: boolean) {
      const card = current.value;
      if (!reviewActive.value || !card) return;
      reviewGrades.set(card.id, correct);
      if (index.value === orderedCards.value.length - 1) void finishReview();
      else go(1);
    }

    async function cancelReview() {
      reviewSetupOpen.value = false;
      await nextTick();
      reviewButton.value?.focus();
    }

    async function deleteCurrentCard() {
      if (!current.value) return;
      const id = current.value.id;
      const position = orderedCards.value.findIndex((card) => card.id === id);
      const next = orderedCards.value[position + 1] ?? orderedCards.value[position - 1];
      const savedIndex = props.set.cards.findIndex((card) => card.id === id);
      if (savedIndex >= 0) props.set.cards.splice(savedIndex, 1);
      reviewGrades.delete(id);
      if (shuffleOrder.value) shuffleOrder.value = shuffleOrder.value.filter((cardId) => cardId !== id);
      currentId.value = next?.id ?? null;
      side.value = reviewSide.value;
      message.value = 'Card deleted.';
      await nextTick();
      (current.value ? deleteButton.value : addButton.value)?.focus();
    }

    function shortcuts(event: KeyboardEvent) {
      // Never capture typing, text navigation, native button activation, or modified shortcuts.
      if ((event.target instanceof Element && event.target.closest('textarea, input, select, button, a, dialog, summary')) ||
          event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (reviewActive.value && index.value === orderedCards.value.length - 1) void finishReview();
        else go(1);
      }
      if (event.key === ' ') { event.preventDefault(); flip(); }
    }

    return () => {
      const card = current.value;
      const position = `Card ${index.value + 1} of ${orderedCards.value.length}`;
      const lastCard = index.value === orderedCards.value.length - 1;
      const orderDescription = reviewOrder.value === 'shuffle' ? 'Shuffled'
        : reviewOrder.value === 'backward' ? 'Last to first' : 'First to last';
      return h('div', {
        ref: layout,
        class: ['card-set-layout', { 'card-list-resizing': cardListResizing.value, 'card-list-collapsed': props.cardListCollapsed }],
        style: props.cardListWidth === null ? null : { '--card-list-width': `${props.cardListWidth}px` },
        onKeydown: shortcuts,
      }, [
        h('div', { class: 'card-set' }, [
        !reviewResult.value && card ? h('section', { class: 'card-review-session', 'aria-label': 'Review status' }, [
          h('div', { class: 'card-review-session-copy' }, [
            h('strong', reviewActive.value ? 'Review in progress' : 'Browse & edit'),
            h('p', { role: 'status' }, reviewActive.value
              ? `${position} · ${reviewSide.value === 'front' ? 'Front' : 'Back'} first · ${orderDescription}`
              : `${position} · ${reviewNotice.value || 'Edit either side'}`),
          ]),
          h('div', { class: 'card-review-session-actions' }, [
            h('button', {
              ref: reviewButton, type: 'button', class: 'quiet-button card-review-button', 'aria-haspopup': 'dialog',
              onClick: () => { reviewSetupOpen.value = true; },
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
          summary: `${reviewResult.value.correct} of ${reviewResult.value.total} cards marked Got it. Ungraded cards count as missed.`,
          onDone: dismissReviewResult,
          onReviewAgain: reviewAgain,
        }) : card ? h('div', {
          ref: stack,
          class: ['ruled-card-stack', { 'has-second-card': props.set.cards.length > 1, 'has-third-card': props.set.cards.length > 2 }],
          tabindex: 0,
          role: 'group',
          'aria-label': `Card ${index.value + 1} of ${orderedCards.value.length}. Use left and right arrows to navigate, Space to flip.`,
        }, [h(CardPaper, {
          key: card.id, ref: editor, card, side: side.value, position: index.value + 1, reviewing: reviewActive.value,
        })]) : h('div', { class: 'card-set-empty' }, [
          h(Icon, { name: 'cards' }),
          h('h3', 'A fresh stack.'),
          h('p', 'Add your first card, then write directly on either side.'),
          h('button', {
            ref: addButton, type: 'button', class: 'card-primary-button',
            disabled: atLimit.value, onClick: () => addCard(),
          }, [h(Icon, { name: 'plus' }), 'Add first card']),
        ]),
        !reviewResult.value && card ? h('div', { class: 'card-controls' }, [
          h('div', { class: 'card-review-controls', 'aria-label': 'Review cards' }, [
            h('button', {
              type: 'button', class: 'quiet-button card-previous', title: 'Previous card',
              'aria-label': 'Previous card', disabled: index.value === 0, onClick: () => go(-1),
            }, [h(Icon, { name: 'chevron' }), 'Previous']),
            h('button', {
              type: 'button', class: 'card-flip-button',
              'aria-label': `Flip to ${side.value === 'front' ? 'back' : 'front'}`, onClick: flip,
            }, [h(Icon, { name: 'flip' }), side.value === 'front' ? 'Show back' : 'Show front']),
            h('button', {
              type: 'button', class: 'quiet-button',
              disabled: lastCard && !reviewActive.value,
              onClick: () => lastCard && reviewActive.value ? finishReview() : go(1),
            }, lastCard && reviewActive.value ? 'Finish review' : ['Next card', h(Icon, { name: 'chevron' })]),
          ]),
          reviewActive.value ? h('div', { class: 'card-review-grade-actions', 'aria-label': 'Score this card' }, [
            h('button', {
              type: 'button', class: 'quiet-button card-review-grade-button is-missed',
              onClick: () => gradeCurrent(false),
            }, 'Missed it'),
            h('button', {
              type: 'button', class: 'quiet-button card-review-grade-button is-got',
              onClick: () => gradeCurrent(true),
            }, 'Got it'),
          ]) : null,
          reviewActive.value ? h('p', { class: 'card-review-instruction' },
            `Check yourself, then choose Got it or Missed it to score and continue. ${lastCard ? 'Finish review' : 'Next card'} without grading counts as missed.`) : null,
          h('div', { class: 'card-edit-controls', 'aria-label': 'Card actions' }, [
            h('button', {
              ref: addButton, type: 'button', class: 'quiet-button', disabled: atLimit.value,
              onClick: () => addCard(),
            }, [h(Icon, { name: 'plus' }), 'New card']),
            h('button', {
              type: 'button', class: 'quiet-button', disabled: atLimit.value,
              onClick: () => addCard(true),
            }, [h(Icon, { name: 'duplicate' }), 'Duplicate']),
            h('button', {
              ref: deleteButton, type: 'button', class: 'icon-button delete-button',
              title: 'Delete card', 'aria-label': 'Delete card', onClick: deleteCurrentCard,
            }, [h(Icon, { name: 'trash' })]),
          ]),
          h('p', { class: 'card-edit-hint' }, `Write directly on either side · ${card[side.value].length} / ${MAX_CARD_TEXT_LENGTH}`),
        ]) : null,
        atLimit.value ? h('p', { class: 'card-limit-message', role: 'status' }, `Workspace limit reached: ${MAX_CARDS} cards.`) : null,
        h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        reviewSetupOpen.value ? h(ReviewSetup, {
          initialSide: reviewSide.value, initialOrder: reviewOrder.value,
          cardCount: props.set.cards.length,
          modal: !props.tutorialReview,
          onCancel: cancelReview, onStart: startReview,
        }) : null,
        ]),
        !props.cardListCollapsed ? h('div', {
          class: 'card-list-resizer',
          role: 'separator',
          tabindex: 0,
          'aria-label': 'Resize Cards panel',
          'aria-orientation': 'vertical',
          'aria-valuemin': MIN_CARD_LIST_WIDTH,
          'aria-valuemax': maxCardListWidth(),
          'aria-valuenow': Math.round(currentCardListWidth()),
          onPointerdown: beginCardListResize,
          onPointermove: resizeCardListFromPointer,
          onPointerup: endCardListResize,
          onPointercancel: endCardListResize,
          onKeydown: resizeCardListFromKeyboard,
          onDblclick: () => emit('reset-card-list'),
        }) : null,
        h(CardList, {
          ref: cardList, hidden: props.cardListCollapsed,
          onHide: () => { cardListResizing.value = false; emit('toggle-card-list'); },
          cards: orderedCards.value, selectedId: card?.id ?? null,
          atLimit: atLimit.value, previewSide: reviewSide.value,
          orderLabel: reviewActive.value ? `${orderDescription} · ${reviewSide.value} first` : 'Saved order',
          onSelect: selectCard, onAdd: () => addCard(),
        }),
      ]);
    };
  },
});
