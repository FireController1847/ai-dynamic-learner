import { Icon } from '../../components/icon.js';
import { createCard, MAX_CARDS, MAX_CARD_TEXT_LENGTH, shuffledCardIds } from './card-model.js';
import { CardList } from './card-list.js';
import { CardPaper } from './card-paper.js';
import { ReviewSetup } from './review-setup.js';

const { computed, h, nextTick, onDeactivated, ref, watch } = window.Vue;

export const CardSet = {
  name: 'CardSet',
  props: {
    set: { type: Object, required: true },
    totalCards: { type: Number, required: true },
  },
  setup(props) {
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
    const message = ref('');
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

    onDeactivated(() => { reviewSetupOpen.value = false; });

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
      return h('div', { class: 'card-set-layout', onKeydown: shortcuts }, [
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
              ref: reviewButton, type: 'button', class: 'quiet-button', 'aria-haspopup': 'dialog',
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
          onCancel: cancelReview, onStart: startReview,
        }) : null,
        ]),
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
