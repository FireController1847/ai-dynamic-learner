import { Icon } from '../../components/icon.ts';
import { defineComponent, h } from 'vue';

export const ImportKnowledgeSet = defineComponent({
  name: 'ImportKnowledgeSet',
  props: { destination: { type: String, required: true } },
  emits: { back: () => true },
  setup(props, { emit }) {
    return () => h('section', { class: 'knowledge-import', 'aria-label': 'Import knowledge set' }, [
      h('header', { class: 'knowledge-builder-header' }, [
        h('div', [
          h('h2', 'Import knowledge set'),
          h('p', 'Bring an existing knowledge set into Review.'),
        ]),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
      ]),
      h('p', { class: 'knowledge-muted' }, `Import into ${props.destination}.`),
      h('div', { class: 'knowledge-import-placeholder' }, [
        h(Icon, { name: 'upload' }),
        h('h3', 'Choose an import source'),
        h('p', 'Import sources will be available from this screen.'),
      ]),
    ]);
  },
});
