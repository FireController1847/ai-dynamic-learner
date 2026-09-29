import { Icon } from '../../components/icon.js';
import { createCard, MAX_CARDS, MAX_CARD_TEXT_LENGTH, shuffledCardIds } from './card-model.js';
import { CardList } from './card-list.js';
import { CardPaper } from './card-paper.js';
import { ReviewSetup } from './review-setup.js';

const { computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } = window.Vue;

const MIN_CARD_LIST_WIDTH = 160;
const MAX_CARD_LIST_WIDTH = 480;
const MIN_EDITOR_WIDTH = 400;

export const CardSet = {
  name: 'CardSet',
  props: {
    set: { type: Object, required: true },
    totalCards: { type: Number, required: true },
    cardListWidth: { type: Number, default: null },
    tutorialReview: Boolean,
  },
  emits: ['resize-card-list', 'reset-card-list'],
  setup(props, { emit }) {
    const currentId = ref(props.set.cards[0]?.id ?? null);
    const side = ref('front');
    const reviewSide = ref('front');
    const reviewOrder = ref('forward');
    const reviewSetupOpen = ref(false);
    const reviewActive = ref(false);
    const reviewNotice = ref('');
    const reviewButton = ref(null);
    const stack = ref(null);
    const shuffleOrder = ref(null);
    const editor = ref(null);
    const addButton = ref(null);
    const deleteButton = ref(null);
    const layout = ref(null);
    const cardListResizing = ref(false);
    const message = ref('');
    let layoutObserver = null;
    const orderedCards = computed(() => {
      if (reviewOrder.value === 'backward') return [...props.set.cards].reverse();
      if (!shuffleOrder.value) return props.set.cards;
      const byId = new Map(props.set.cards.map((card) => [card.id, card]));
      return shuffleOrder.value.map((id) => byId.get(id)).filter(Boolean);
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

    function setCardListWidth(width) {
      emit('resize-card-list',
        Math.round(Math.min(Math.max(width, MIN_CARD_LIST_WIDTH), maxCardListWidth())));
    }

    function keepCardListWidthInBounds() {
      if (props.cardListWidth !== null) setCardListWidth(props.cardListWidth);
    }

    function beginCardListResize(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      cardListResizing.value = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeCardListFromPointer(event);
    }

    function resizeCardListFromPointer(event) {
      if (!cardListResizing.value || !layout.value) return;
      const bounds = layout.value.getBoundingClientRect();
      setCardListWidth(bounds.right - event.clientX);
    }

    function endCardListResize(event) {
      cardListResizing.value = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function resizeCardListFromKeyboard(event) {
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
      currentId.value = card.id;
      side.value = reviewSide.value;
      message.value = duplicate ? 'Card duplicated.' : 'New card added.';
      await nextTick();
      editor.value?.focus();
    }

    function go(offset) {
      const card = orderedCards.value[index.value + offset];
      if (!card) return;
      selectCard(card.id);
    }

    function selectCard(id) {
      currentId.value = id;
      side.value = reviewSide.value;
      message.value = '';
    }

    function flip() {
      if (current.value) side.value = side.value === 'front' ? 'back' : 'front';
    }

    async function startReview(settings) {
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

    async function endReview(finished = false) {
      reviewActive.value = false;
      reviewOrder.value = 'forward';
      reviewSide.value = 'front';
      shuffleOrder.value = null;
      side.value = 'front';
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

    async function deleteCurrentCard() {
      if (!current.value) return;
      const id = current.value.id;
      const position = orderedCards.value.findIndex((card) => card.id === id);
      const next = orderedCards.value[position + 1] ?? orderedCards.value[position - 1];
      const savedIndex = props.set.cards.findIndex((card) => card.id === id);
      if (savedIndex >= 0) props.set.cards.splice(savedIndex, 1);
      if (shuffleOrder.value) shuffleOrder.value = shuffleOrder.value.filter((cardId) => cardId !== id);
      currentId.value = next?.id ?? null;
      side.value = reviewSide.value;
      message.value = 'Card deleted.';
      await nextTick();
      (current.value ? deleteButton.value : addButton.value)?.focus();
    }

    function shortcuts(event) {
      // Never capture typing, text navigation, native button activation, or modified shortcuts.
      if (event.target.closest('textarea, input, select, button, a, dialog, summary') ||
          event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
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
        class: ['card-set-layout', { 'card-list-resizing': cardListResizing.value }],
        style: props.cardListWidth === null ? null : { '--card-list-width': `${props.cardListWidth}px` },
        onKeydown: shortcuts,
      }, [
        h('div', { class: 'card-set' }, [
        card ? h('section', { class: 'card-review-session', 'aria-label': 'Review status' }, [
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
              type: 'button', class: 'quiet-button', onClick: () => endReview(false),
            }, 'End review') : null,
          ]),
        ]) : null,
        card ? h('div', {
          ref: stack,
          class: ['ruled-card-stack', { 'has-second-card': props.set.cards.length > 1, 'has-third-card': props.set.cards.length > 2 }],
          tabindex: 0,
          role: 'group',
          'aria-label': `Card ${index.value + 1} of ${orderedCards.value.length}. Use left and right arrows to navigate, Space to flip.`,
        }, [h(CardPaper, {
          key: card.id, ref: editor, card, side: side.value, position: index.value + 1,
        })]) : h('div', { class: 'card-set-empty' }, [
          h(Icon, { name: 'cards' }),
          h('h3', 'A fresh stack.'),
          h('p', 'Add your first card, then write directly on either side.'),
          h('button', {
            ref: addButton, type: 'button', class: 'card-primary-button',
            disabled: atLimit.value, onClick: () => addCard(),
          }, [h(Icon, { name: 'plus' }), 'Add first card']),
        ]),
        card ? h('div', { class: 'card-controls' }, [
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
              onClick: () => lastCard && reviewActive.value ? endReview(true) : go(1),
            }, lastCard && reviewActive.value ? 'Finish review' : ['Next card', h(Icon, { name: 'chevron' })]),
          ]),
          reviewActive.value ? h('p', { class: 'card-review-instruction' },
            `Look at the ${reviewSide.value}, reveal the other side, then ${lastCard ? 'finish the review' : 'choose Next card'}. You can edit at any time.`) : null,
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
        h('div', {
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
        }),
        h(CardList, {
          cards: orderedCards.value, selectedId: card?.id ?? null,
          atLimit: atLimit.value, previewSide: reviewSide.value,
          orderLabel: reviewActive.value ? `${orderDescription} · ${reviewSide.value} first` : 'Saved order',
          onSelect: selectCard, onAdd: () => addCard(),
        }),
      ]);
    };
  },
};
