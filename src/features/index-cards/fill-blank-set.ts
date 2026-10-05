import type { CardSet as CardSetModel } from './tree-model.ts';
import type { Card } from './card-model.ts';
import type { ReviewOrder } from './review-setup.ts';
import type { FillBlankEditorHandle } from './fill-blank-editor.ts';
import { Icon } from '../../components/icon.ts';
import { createCard, MAX_CARDS, shuffledCardIds } from './card-model.ts';
import { CardList } from './card-list.ts';
import { FillBlankEditor } from './fill-blank-editor.ts';
import { FillBlankPaper } from './fill-blank-paper.ts';
import { FillBlankReviewSetup } from './fill-blank-review-setup.ts';
import { isFillBlankAnswerCorrect, parseFillBlankTemplate } from './fill-blank-model.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

const MIN_CARD_LIST_WIDTH = 160;
const MAX_CARD_LIST_WIDTH = 480;
const MIN_EDITOR_WIDTH = 400;

export const FillBlankSet = defineComponent({
  name: 'FillBlankSet',
  props: {
    set: { type: Object as PropType<CardSetModel>, required: true },
    totalCards: { type: Number, required: true },
    cardListWidth: { type: Number as PropType<number | null>, default: null },
  },
  emits: { 'resize-card-list': (_width: number) => true, 'reset-card-list': () => true },
  setup(props, { emit }) {
    const currentId = ref(props.set.cards[0]?.id ?? null);
    const reviewOrder = ref<ReviewOrder>('forward');
    const reviewSetupOpen = ref(false);
    const reviewActive = ref(false);
    const reviewNotice = ref('');
    const reviewButton = ref<HTMLButtonElement | null>(null);
    const stack = ref<HTMLElement | null>(null);
    const shuffleOrder = ref<string[] | null>(null);
    const responses = ref<string[]>([]);
    const verified = ref(false);
    const editor = ref<FillBlankEditorHandle | null>(null);
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
      if (!length && reviewActive.value) endReview(false);
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

    function resetAttempt() {
      responses.value = [];
      verified.value = false;
    }
    async function addCard(duplicate = false) {
      if (atLimit.value) return;
      const card = createCard(duplicate ? current.value : null);
      const sourceIndex = props.set.cards.findIndex((item) => item.id === current.value?.id);
      props.set.cards.splice(sourceIndex + 1, 0, card);
      if (shuffleOrder.value) shuffleOrder.value.splice(index.value + 1, 0, card.id);
      currentId.value = card.id;
      resetAttempt();
      message.value = duplicate ? 'Card duplicated.' : 'New card added.';
      await nextTick();
      if (!reviewActive.value) editor.value?.focus();
    }
    function selectCard(id: string) {
      currentId.value = id;
      resetAttempt();
      message.value = '';
    }
    function go(offset: number) {
      const card = orderedCards.value[index.value + offset];
      if (card) selectCard(card.id);
    }

    async function startReview(order: ReviewOrder) {
      reviewActive.value = true;
      reviewNotice.value = '';
      reviewOrder.value = order;
      shuffleOrder.value = order === 'shuffle' ? shuffledCardIds(props.set.cards) : null;
      currentId.value = orderedCards.value[0]?.id ?? null;
      resetAttempt();
      reviewSetupOpen.value = false;
      message.value = `Review started: ${order}.`;
      await nextTick();
      stack.value?.focus();
    }
    async function endReview(finished = false) {
      reviewActive.value = false;
      reviewOrder.value = 'forward';
      shuffleOrder.value = null;
      resetAttempt();
      reviewNotice.value = finished
        ? 'Review finished. Keep editing, or start another review.'
        : 'Review ended. You are back to browsing in saved order.';
      await nextTick();
      reviewButton.value?.focus();
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
      if (!card) return;
      const template = parseFillBlankTemplate(card.front);
      if (!template.answers.length ||
          template.answers.some((_answer, blankIndex) => !(responses.value[blankIndex] ?? '').trim())) return;
      verified.value = true;
      const correct = template.answers.filter((answer, blankIndex) =>
        isFillBlankAnswerCorrect(answer, responses.value[blankIndex] ?? '')).length;
      message.value = `${correct} of ${template.answers.length} ${template.answers.length === 1 ? 'blank' : 'blanks'} correct.`;
    }

    async function deleteCurrentCard() {
      if (!current.value) return;
      const id = current.value.id;
      const position = orderedCards.value.findIndex((card) => card.id === id);
      const next = orderedCards.value[position + 1] ?? orderedCards.value[position - 1];
      const savedIndex = props.set.cards.findIndex((card) => card.id === id);
      if (savedIndex >= 0) props.set.cards.splice(savedIndex, 1);
      if (shuffleOrder.value) shuffleOrder.value = shuffleOrder.value.filter((cardId) => cardId !== id);
      currentId.value = next?.id ?? null;
      resetAttempt();
      message.value = 'Card deleted.';
      await nextTick();
      (current.value ? deleteButton.value : addButton.value)?.focus();
    }

    function preserveEditorSelection(event: MouseEvent) {
      event.preventDefault();
    }
    function shortcuts(event: KeyboardEvent) {
      if ((event.target instanceof Element && event.target.closest('[contenteditable], input, select, button, a, dialog, summary')) ||
          event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'ArrowRight') {
        const blanks = current.value ? parseFillBlankTemplate(current.value.front).answers.length : 0;
        if (!reviewActive.value || verified.value || blanks === 0) {
          event.preventDefault();
          go(1);
        }
      }
    }

    return () => {
      const card = current.value;
      const template = card ? parseFillBlankTemplate(card.front) : { segments: [], answers: [] };
      const blankCount = template.answers.length;
      const allFilled = blankCount > 0 &&
        template.answers.every((_answer, blankIndex) => Boolean((responses.value[blankIndex] ?? '').trim()));
      const correctCount = verified.value
        ? template.answers.filter((answer, blankIndex) =>
          isFillBlankAnswerCorrect(answer, responses.value[blankIndex] ?? '')).length
        : 0;
      const position = `Card ${index.value + 1} of ${orderedCards.value.length}`;
      const lastCard = index.value === orderedCards.value.length - 1;
      const canAdvance = verified.value || blankCount === 0;
      const orderDescription = reviewOrder.value === 'shuffle' ? 'Shuffled'
        : reviewOrder.value === 'backward' ? 'Last to first' : 'First to last';

      return h('div', {
        ref: layout,
        class: ['card-set-layout', 'fill-blank-set-layout', { 'card-list-resizing': cardListResizing.value }],
        style: props.cardListWidth === null ? null : { '--card-list-width': `${props.cardListWidth}px` },
        onKeydown: shortcuts,
      }, [
        h('div', { class: 'card-set fill-blank-set' }, [
          card ? h('section', { class: 'card-review-session', 'aria-label': 'Review status' }, [
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
                type: 'button', class: 'quiet-button', onClick: () => endReview(false),
              }, 'End review') : null,
            ]),
          ]) : null,
          card ? h('div', { class: ['fill-blank-stage', { 'is-reviewing': reviewActive.value }] }, [
            h('div', {
              ref: stack,
              class: ['ruled-card-stack', {
                'has-second-card': props.set.cards.length > 1,
                'has-third-card': props.set.cards.length > 2,
              }],
              tabindex: reviewActive.value ? 0 : -1,
              role: 'group',
              'aria-label': reviewActive.value
                ? `Card ${index.value + 1} of ${orderedCards.value.length}. Fill every blank, then verify.`
                : `Card ${index.value + 1} of ${orderedCards.value.length}. Select text and use the blank tools to edit the exercise.`,
            }, [
              reviewActive.value
                ? h(FillBlankPaper, {
                  key: `review-${card.id}`, card, position: index.value + 1,
                  responses: responses.value, verified: verified.value,
                  onUpdateResponse: updateResponse,
                })
                : h(FillBlankEditor, {
                  key: `edit-${card.id}`, ref: editor, card, position: index.value + 1,
                  onMessage: (value: string) => { message.value = value; },
                }),
            ]),
            !reviewActive.value ? h('aside', { class: 'fill-blank-tools', 'aria-label': 'Blank editing tools' }, [
              h('strong', 'Blanks'),
              h('button', {
                type: 'button', class: 'quiet-button fill-blank-tool-button',
                onMousedown: preserveEditorSelection,
                onClick: () => editor.value?.makeBlank(),
              }, [h(Icon, { name: 'plus' }), 'Make blank']),
              h('button', {
                type: 'button', class: 'quiet-button fill-blank-tool-button',
                onMousedown: preserveEditorSelection,
                onClick: () => editor.value?.removeBlank(),
              }, [h(Icon, { name: 'minus' }), 'Remove blank']),
              h('p', 'Select text to make a blank. Put the cursor in a highlighted blank to remove it.'),
            ]) : null,
          ]) : h('div', { class: 'card-set-empty' }, [
            h(Icon, { name: 'cards' }),
            h('h3', 'A fresh fill-in set.'),
            h('p', 'Add a card, write the prompt, then select the words learners should recall.'),
            h('button', {
              ref: addButton, type: 'button', class: 'card-primary-button',
              disabled: atLimit.value, onClick: () => addCard(),
            }, [h(Icon, { name: 'plus' }), 'Add first card']),
          ]),
          card ? h('div', { class: 'card-controls' }, [
            h('div', {
              class: 'card-review-controls',
              'aria-label': reviewActive.value ? 'Fill in the blanks review' : 'Browse cards',
            }, [
              h('button', {
                type: 'button', class: 'quiet-button card-previous',
                title: 'Previous card', 'aria-label': 'Previous card',
                disabled: index.value === 0, onClick: () => go(-1),
              }, [h(Icon, { name: 'chevron' }), 'Previous']),
              reviewActive.value ? h('button', {
                type: 'button', class: 'card-flip-button fill-blank-verify-button',
                disabled: !allFilled || verified.value, onClick: verify,
              }, [h(Icon, { name: verified.value ? 'verified' : 'checklist' }), verified.value ? 'Verified' : 'Verify'])
                : h('div', { class: 'fill-blank-edit-summary', 'aria-live': 'polite' },
                  `${blankCount} ${blankCount === 1 ? 'blank' : 'blanks'}`),
              h('button', {
                type: 'button', class: 'quiet-button',
                disabled: reviewActive.value ? !canAdvance : lastCard,
                onClick: () => reviewActive.value && lastCard ? endReview(true) : go(1),
              }, reviewActive.value && lastCard && canAdvance
                ? 'Finish review'
                : reviewActive.value && blankCount === 0
                  ? 'Skip'
                  : ['Next card', h(Icon, { name: 'chevron' })]),
            ]),
            h('p', { class: 'card-review-instruction fill-blank-authoring-hint' },
              reviewActive.value
                ? blankCount === 0
                  ? 'No blanks are defined on this card. End review to edit it, or skip to the next card.'
                  : verified.value
                    ? `${correctCount} of ${blankCount} correct. Correct answers are green; missed answers appear below them in red.`
                    : 'Fill every blank before Verify becomes available. All answers are checked together.'
                : message.value || 'Write directly on the card, select a word or phrase, then choose Make blank.'),
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
            initialOrder: reviewOrder.value, cardCount: props.set.cards.length,
            onCancel: cancelReview, onStart: startReview,
          }) : null,
        ]),
        h('div', {
          class: 'card-list-resizer', role: 'separator', tabindex: 0,
          'aria-label': 'Resize Cards panel', 'aria-orientation': 'vertical',
          'aria-valuemin': MIN_CARD_LIST_WIDTH, 'aria-valuemax': maxCardListWidth(),
          'aria-valuenow': Math.round(currentCardListWidth()),
          onPointerdown: beginCardListResize, onPointermove: resizeCardListFromPointer,
          onPointerup: endCardListResize, onPointercancel: endCardListResize,
          onKeydown: resizeCardListFromKeyboard, onDblclick: () => emit('reset-card-list'),
        }),
        h(CardList, {
          cards: orderedCards.value, selectedId: card?.id ?? null,
          atLimit: atLimit.value, previewSide: 'front', maskBlanks: true,
          orderLabel: reviewActive.value ? `${orderDescription} · fill in the blanks` : 'Saved order',
          onSelect: selectCard, onAdd: () => addCard(),
        }),
      ]);
    };
  },
});
