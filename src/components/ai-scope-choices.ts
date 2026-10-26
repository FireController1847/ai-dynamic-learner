import { defineComponent, h } from 'vue';
import { Icon } from './icon.ts';

/** A visual example of whole-source study versus a focused category. */
export const AiScopeChoices = defineComponent({
  name: 'AiScopeChoices',
  emits: { overall: () => true, category: () => true },
  setup(_, { emit }) {
    function topics(focused: boolean) {
      return h('div', { class: 'ai-scope-example', 'aria-hidden': 'true' }, [
        h('small', 'Example source'),
        h('div', ['Cells', 'Digestion', 'Nutrition'].map((name, index) =>
          h('span', { class: ['ai-scope-chip', { 'is-focus': !focused || index === 1, 'is-muted': focused && index !== 1 }] }, name))),
        h('span', { class: 'ai-scope-example-output' }, [
          h(Icon, { name: 'chevron' }), focused ? 'Study Digestion only' : 'Study a mix of all topics',
        ]),
      ]);
    }
    return () => h('div', { class: 'ai-scope-choices', 'aria-label': 'Choose how much of your material to study' }, [
      h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('overall') }, [
        h('strong', 'Overall subject'),
        h('span', 'Make study content from everything you shared.'),
        topics(false),
      ]),
      h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('category') }, [
        h('strong', 'Choose a category'),
        h('span', 'First group the material into topics, then focus on just one.'),
        topics(true),
      ]),
    ]);
  },
});
