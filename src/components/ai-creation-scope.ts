import { defineComponent, h } from 'vue';
import { AiScopeChoices } from './ai-scope-choices.ts';

/** Review-style scope decision shared by every AI content creator.
 * The caller owns navigation, selected categories, and app-specific settings. */
export const AiCreationScope = defineComponent({
  name: 'AiCreationScope',
  props: {
    exitLabel: { type: String, default: 'Cancel' },
    showExit: { type: Boolean, default: true },
    showImport: { type: Boolean, default: true },
  },
  emits: {
    overall: () => true,
    category: () => true,
    direct: () => true,
    exit: () => true,
  },
  setup(props, { emit }) {
    return () => [
      h(AiScopeChoices, {
        onOverall: () => emit('overall'),
        onCategory: () => emit('category'),
      }),
      props.showImport || props.showExit ? h('div', { class: 'study-ai-actions ai-scope-actions' }, [
        props.showImport ? h('button', {
          type: 'button', class: 'quiet-button outline-button',
          style: { width: 'auto', flex: '0 0 auto' },
          onClick: () => emit('direct'),
        }, 'Import an AI response') : null,
        props.showExit ? h('button', {
          type: 'button', class: 'quiet-button',
          style: { width: 'auto', flex: '0 0 auto' },
          onClick: () => emit('exit'),
        }, props.exitLabel) : null,
      ]) : null,
    ];
  },
});
