import type { CheckItem } from './library-model.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { CHECK_MODES, isCheckMode, type CheckModeId } from './check-types.ts';
import { validateQuestions, type Question } from './question-model.ts';
import { inputValue } from '../../core/dom.ts';
import { CheckBuilder } from './check-builder.ts';
import { ModePicker } from './mode-picker.ts';
import { KnowledgeSession } from './knowledge-session.ts';
import { defineComponent, h, KeepAlive, ref, type PropType } from 'vue';

export const KnowledgeSet = defineComponent({
  name: 'KnowledgeSet',
  props: { item: { type: Object as PropType<CheckItem>, required: true } },
  setup(props) {
    const mode = ref<CheckModeId | null>(props.item.mode ?? null);
    const building = ref(false);
    const revision = ref(0);
    const message = ref('');
    function chooseMode(next: CheckModeId) { mode.value = next; props.item.mode = next; }
    function save(name: string, questions: Question[]) {
      try {
        validateQuestions(questions);
        if (!name.trim() || name.length > MAX_NAME_LENGTH) throw new Error('Enter a name of 1–120 characters.');
        props.item.name = name.trim(); props.item.questions = questions;
        building.value = false; revision.value += 1; message.value = '';
      } catch (error) { message.value = error instanceof Error ? error.message : String(error); }
    }
    return () => h('div', { class: 'knowledge-set-workspace' }, [
      h('header', { class: 'knowledge-set-toolbar' }, [
        h('label', { class: 'knowledge-mode-control' }, ['Mode', h('select', {
          value: mode.value ?? '', disabled: building.value,
          onChange: (event: Event) => { const value = inputValue(event); if (isCheckMode(value)) chooseMode(value); },
        }, [h('option', { value: '', disabled: true }, 'Choose a mode'), ...CHECK_MODES.map((entry) => h('option', { value: entry.id }, entry.label))])]),
        h('span', { class: 'knowledge-muted' }, `${props.item.questions.length} questions`),
        h('button', { type: 'button', class: 'quiet-button', disabled: building.value,
          onClick: () => { building.value = true; } }, 'Build questions'),
      ]),
      building.value ? h(CheckBuilder, { key: `builder-${revision.value}`, item: props.item, onSave: save,
        onCancel: () => { building.value = false; message.value = ''; } }) : null,
      !building.value && !mode.value ? h(ModePicker, { setName: props.item.name,
        onChoose: chooseMode, onBuild: () => { building.value = true; } }) : null,
      h(KeepAlive, { key: revision.value }, { default: () => !building.value && mode.value ? h(KnowledgeSession, {
        key: mode.value, item: props.item, mode: mode.value, onBuild: () => { building.value = true; },
      }) : null }),
      message.value ? h('p', { class: 'knowledge-message', role: 'alert' }, message.value) : null,
    ]);
  },
});
