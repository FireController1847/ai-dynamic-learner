import type { Card, CardSide } from './card-model.ts';
import { Icon } from '../../components/icon.ts';
import { cardTitle } from './card-model.ts';
import { maskFillBlankAnswers } from './fill-blank-model.ts';

import { defineComponent, type PropType, h, nextTick, onMounted, ref, watch } from 'vue';

export const CardList = defineComponent({
  name: 'CardList',
  props: {
    cards: { type: Array as PropType<Card[]>, required: true },
    selectedId: { type: String as PropType<string | null>, default: null },
    atLimit: Boolean,
    previewSide: { type: String as PropType<CardSide>, default: 'front' },
    orderLabel: { type: String, default: 'Forward · front first' },
    maskBlanks: Boolean,
  },
  emits: { 'select': (_id: string) => true, 'add': () => true },
  setup(props, { emit }) {
    const list = ref<HTMLElement | null>(null);
    const rows = new Map<string | null, HTMLElement>();

    function revealSelected() {
      const row = rows.get(props.selectedId);
      const container = list.value;
      if (!row || !container) return;
      if (row.offsetTop < container.scrollTop) container.scrollTop = row.offsetTop;
      else if (row.offsetTop + row.offsetHeight > container.scrollTop + container.clientHeight) {
        container.scrollTop = row.offsetTop + row.offsetHeight - container.clientHeight;
      }
      if (row.offsetLeft < container.scrollLeft) container.scrollLeft = row.offsetLeft;
      else if (row.offsetLeft + row.offsetWidth > container.scrollLeft + container.clientWidth) {
        container.scrollLeft = row.offsetLeft + row.offsetWidth - container.clientWidth;
      }
    }
    onMounted(revealSelected);
    watch(() => [props.selectedId, props.cards.map((card) => card.id).join(',')], revealSelected, { flush: 'post' });

    async function navigate(event: KeyboardEvent, index: number) {
      const targets: Record<string, number> = {
        ArrowUp: index - 1, ArrowLeft: index - 1,
        ArrowDown: index + 1, ArrowRight: index + 1,
        Home: 0, End: props.cards.length - 1,
      };
      if (!(event.key in targets) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      const card = props.cards[Math.max(0, Math.min(props.cards.length - 1, targets[event.key]))];
      if (!card) return;
      emit('select', card.id);
      await nextTick();
      rows.get(card.id)?.querySelector('button')?.focus({ preventScroll: true });
    }

    return () => h('aside', { class: 'card-list-panel', 'aria-label': 'Cards in this set' }, [
      h('div', { class: 'card-list-toolbar' }, [
        h('h3', ['Cards ', h('span', { class: 'card-list-count' }, String(props.cards.length))]),
        h('button', {
          type: 'button', class: 'icon-button', title: 'New card', 'aria-label': 'New card',
          disabled: props.atLimit, onClick: () => emit('add'),
        }, [h(Icon, { name: 'plus' })]),
      ]),
      h('p', { class: 'card-list-order' }, props.orderLabel),
      props.cards.length ? h('ol', { ref: list, class: 'card-list-items' }, props.cards.map((card, index) =>
        h('li', {
          key: card.id,
          ref: (element) => { if (element instanceof HTMLElement) rows.set(card.id, element); else rows.delete(card.id); },
        }, [h('button', {
          type: 'button', class: 'card-list-item',
          'aria-current': props.selectedId === card.id ? 'true' : undefined,
          onClick: () => emit('select', card.id), onKeydown: (event: KeyboardEvent) => navigate(event, index),
        }, [
          h('span', { class: 'card-list-number', 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')),
          h('span', { class: 'card-list-copy' }, [
            h('span', { class: 'card-list-title', title: cardTitle(card, `Card ${index + 1}`, props.previewSide) }, cardTitle(card, `Card ${index + 1}`, props.previewSide)),
            h('span', { class: 'card-list-preview' }, (
              props.maskBlanks && props.previewSide === 'front'
                ? maskFillBlankAnswers(card.front)
                : card[props.previewSide]
            ).trim().replace(/\s+/g, ' ').slice(0, 160) || `Blank ${props.previewSide}`),
          ]),
        ])]),
      )) : h('p', { class: 'card-list-empty' }, 'Your cards will appear here.'),
    ]);
  },
});
