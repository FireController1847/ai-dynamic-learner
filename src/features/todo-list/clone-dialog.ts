import { defineComponent, h } from 'vue';
import { PopupDialog } from '../../components/popup-dialog.ts';

export const TodoCloneDialog = defineComponent({
  name: 'TodoCloneDialog',
  props: { listName: { type: String, required: true }, error: { type: String, default: '' } },
  emits: { close: () => true, clone: (skipRemaining: boolean) => typeof skipRemaining === 'boolean' },
  setup(props, { emit }) {
    return () => h(PopupDialog, {
      title: 'Clone todo list', headingId: 'todo-clone-heading', width: 500, onClose: () => emit('close'),
    }, { default: () => h('div', { class: 'todo-clone-options' }, [
      h('p', {}, `Create a new copy of “${props.listName}”, including its sections, priorities, and task states.`),
      h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('clone', false) }, [
        h('strong', {}, 'Clone without changes'),
        h('span', {}, 'Leave the original list unchanged.'),
      ]),
      h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('clone', true) }, [
        h('strong', {}, 'Clone and skip remaining tasks'),
        h('span', {}, 'After copying, mark unfinished tasks as skipped on the original list.'),
      ]),
      props.error ? h('p', { role: 'alert' }, props.error) : null,
    ]) });
  },
});
