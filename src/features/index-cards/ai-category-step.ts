import { defineComponent, h, ref, Transition, type PropType } from 'vue';
import { AiCategoryPicker } from '../../components/ai-category-picker.ts';
import type { AiCardCategories, AiCardScope } from '../../core/ai-study-categories.ts';
import { IndexCardsAiImport, type IndexCardsAiImportValue } from './ai-import.ts';
import { getSetMode, type SetModeId } from './set-modes.ts';

export const IndexCardsAiCreation = defineComponent({
  name: 'IndexCardsAiCreation',
  props: {
    destination: { type: String, required: true },
    remainingCards: { type: Number, required: true },
    mode: { type: String as PropType<SetModeId>, required: true },
  },
  emits: { back: () => true, cancel: () => true, import: (_value: IndexCardsAiImportValue) => true },
  setup(props, { emit }) {
    const categories = ref<AiCardCategories | null>(null);
    const scope = ref<AiCardScope | null>(null);
    const backward = ref(false);
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in' }, {
        default: () => scope.value ? h(IndexCardsAiImport, {
          key: scope.value.category.key, mode: props.mode, destination: props.destination, remainingCards: props.remainingCards,
          scope: scope.value, onBack: () => { backward.value = true; scope.value = null; },
          onCancel: () => emit('cancel'), onImport: (value: IndexCardsAiImportValue) => emit('import', value),
        }) : h(AiCategoryPicker, {
          key: 'categories', label: getSetMode(props.mode)?.label, destination: props.destination,
          initialCategories: categories.value, onBack: () => emit('back'), onCancel: () => emit('cancel'),
          onSelect: (selected: AiCardScope, list: AiCardCategories) => { backward.value = false; categories.value = list; scope.value = selected; },
        }),
      }),
    ]);
  },
});
