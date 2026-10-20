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
    const entry = ref<'scope' | 'categories' | 'direct' | 'overall' | 'category'>('scope');
    return () => h('div', { class: ['ai-workflow', { 'is-backward': backward.value }] }, [
      h(Transition, { name: 'ai-workflow-step', mode: 'out-in' }, {
        default: () => entry.value === 'scope' ? h('section', { key: 'scope', class: 'study-ai-workspace' }, [
          h('header', { class: 'study-ai-header' }, [h('div', [h('h2', 'Create ' + (getSetMode(props.mode)?.label ?? 'Index Cards') + ' with AI'), h('p', 'Choose the scope or import an existing JSON response.')]),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back')]),
          h('div', { class: 'review-ai-scope' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { scope.value = null; entry.value = 'overall'; } }, [h('strong', 'Overall subject'), h('span', 'Create cards across the full source.')]),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { entry.value = 'categories'; } }, [h('strong', 'Choose a category'), h('span', 'Focus on one source category.')]),
          ]),
          h('div', { class: 'study-ai-actions', style: { justifyContent: 'flex-start', marginTop: '1rem' } }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { scope.value = null; entry.value = 'direct'; } }, 'Import existing JSON'),
          ]),
        ]) : entry.value !== 'categories' ? h(IndexCardsAiImport, {
          key: scope.value?.category.key ?? entry.value, direct: entry.value === 'direct', mode: props.mode, destination: props.destination, remainingCards: props.remainingCards,
          scope: scope.value, onBack: () => { backward.value = true; scope.value = null; entry.value = 'scope'; },
          onCancel: () => emit('cancel'), onImport: (value: IndexCardsAiImportValue) => emit('import', value),
        }) : h(AiCategoryPicker, {
          key: 'categories', label: getSetMode(props.mode)?.label, destination: props.destination,
          initialCategories: categories.value, onBack: () => { entry.value = 'scope'; }, onCancel: () => emit('cancel'),
          onSelect: (selected: AiCardScope, list: AiCardCategories) => { backward.value = false; categories.value = list; scope.value = selected; entry.value = 'category'; },
        }),
      }),
    ]);
  },
});
