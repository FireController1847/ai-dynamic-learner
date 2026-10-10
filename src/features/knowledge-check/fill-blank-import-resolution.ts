import { useDialog } from '../../components/use-dialog.ts';
import { computed, defineComponent, h, ref, type PropType } from 'vue';
import type {
  BlanklessFillCard,
  BlanklessFillCardAction,
  BlanklessFillCardActions,
} from './import-index-cards.ts';

export const FillBlankImportResolution = defineComponent({
  name: 'FillBlankImportResolution',
  props: {
    entries: { type: Array as PropType<BlanklessFillCard[]>, required: true },
    initial: { type: Object as PropType<BlanklessFillCardActions>, required: true },
  },
  emits: {
    cancel: () => true,
    apply: (_actions: BlanklessFillCardActions) => true,
  },
  setup(props, { emit }) {
    const { dialog } = useDialog();
    const choices = ref<BlanklessFillCardActions>({ ...props.initial });
    const complete = computed(() => props.entries.every((entry) => Boolean(choices.value[entry.cardId])));

    function setChoice(cardId: string, action: BlanklessFillCardAction) {
      choices.value = { ...choices.value, [cardId]: action };
    }

    return () => h('dialog', {
      ref: dialog,
      class: 'knowledge-import-resolution',
      'aria-labelledby': 'knowledge-import-resolution-title',
      onCancel: (event: Event) => { event.preventDefault(); emit('cancel'); },
    }, [
      h('form', {
        onSubmit: (event: Event) => {
          event.preventDefault();
          if (complete.value) emit('apply', { ...choices.value });
        },
      }, [
        h('header', [
          h('h2', { id: 'knowledge-import-resolution-title' }, 'Cards without blanks'),
          h('p', `${props.entries.length} ${props.entries.length === 1 ? 'card was' : 'cards were'} found without blanks. Choose what Review should do with each card.`),
        ]),
        h('div', { class: 'knowledge-import-resolution-list' }, props.entries.map((entry) =>
          h('fieldset', { class: 'knowledge-import-resolution-card', key: entry.cardId }, [
            h('legend', entry.label),
            h('p', { class: 'knowledge-import-resolution-preview' }, entry.text),
            h('div', { class: 'knowledge-import-resolution-actions' }, [
              h('label', [
                h('input', {
                  type: 'radio',
                  name: `blankless-${entry.cardId}`,
                  checked: choices.value[entry.cardId] === 'statement',
                  onChange: () => setChoice(entry.cardId, 'statement'),
                }),
                h('span', [
                  h('strong', 'Convert to Statement'),
                  h('span', 'Keep the visible card text as an unscored Review item.'),
                ]),
              ]),
              h('label', [
                h('input', {
                  type: 'radio',
                  name: `blankless-${entry.cardId}`,
                  checked: choices.value[entry.cardId] === 'discard',
                  onChange: () => setChoice(entry.cardId, 'discard'),
                }),
                h('span', [
                  h('strong', 'Discard'),
                  h('span', 'Do not include this card in the imported knowledge set.'),
                ]),
              ]),
            ]),
          ]))),
        h('div', { class: 'knowledge-import-resolution-footer' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
          h('button', { type: 'submit', class: 'card-primary-button', disabled: !complete.value }, 'Apply decisions'),
        ]),
      ]),
    ]);
  },
});
