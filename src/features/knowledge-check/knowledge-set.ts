import type { CheckItem } from './library-model.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { CHECK_MODES, isCheckMode, type CheckModeId } from './check-types.ts';
import { requestLeave } from '../../core/leave-guards.ts';
import { validateSetOptions, type SetOptions } from './set-options.ts';
import { validateQuestions, questionsForSave, type Question } from './question-model.ts';
import { inputValue } from '../../core/dom.ts';
import { CheckBuilder } from './check-builder.ts';
import { ModePicker } from './mode-picker.ts';
import { KnowledgeSession } from './knowledge-session.ts';
import { SessionSetup } from './session-setup.ts';
import { settingsForMode, type SessionSettings } from './session-settings.ts';
import { questionReady } from './question-model.ts';
import { enterReviewPanel, leaveReviewPanel, restoreReviewPanel } from './review-motion.ts';
import { defineComponent, h, onDeactivated, ref, Transition, type PropType } from 'vue';

export const KnowledgeSet = defineComponent({
  name: 'KnowledgeSet',
  props: { item: { type: Object as PropType<CheckItem>, required: true }, initialBuilder: Boolean,
    initialMode: { type: String as PropType<CheckModeId | null>, default: null } },
  setup(props) {
    const mode = ref<CheckModeId | null>(props.initialMode);
    const building = ref(props.initialBuilder);
    const sessionSettings = ref<SessionSettings | null>(
      props.initialMode === 'test' ? settingsForMode(props.item.options, 'test') : null);
    const revision = ref(0);
    const message = ref('');
    onDeactivated(() => { mode.value = null; sessionSettings.value = null; });
    function chooseMode(next: CheckModeId) {
      if (mode.value !== next && !requestLeave()) return;
      mode.value = next;
      sessionSettings.value = next === 'test' ? settingsForMode(props.item.options, 'test') : null;
    }
    function openBuilder() { if (requestLeave()) building.value = true; }
    function save(name: string, questions: Question[], options: SetOptions) {
      try {
        validateQuestions(questions); validateSetOptions(options);
        const ready = questionsForSave(questions);
        if (!name.trim() || name.length > MAX_NAME_LENGTH) throw new Error('Enter a name of 1–120 characters.');
        props.item.name = name.trim(); props.item.questions = ready; props.item.options = { ...options };
        sessionSettings.value = mode.value === 'test' ? settingsForMode(props.item.options, 'test') : null;
        building.value = false; revision.value += 1; message.value = '';
      } catch (error) { message.value = error instanceof Error ? error.message : String(error); }
    }
    function renderWorkspaceView() {
      if (building.value) return h(CheckBuilder, {
        key: `builder-${revision.value}`, item: props.item, onSave: save,
        onCancel: () => { building.value = false; message.value = ''; },
      });
      if (!mode.value) return h(ModePicker, {
        key: 'mode-picker', setName: props.item.name, onChoose: chooseMode, onBuild: openBuilder,
      });
      if (!sessionSettings.value) return h(SessionSetup, {
        key: `setup-${revision.value}-${mode.value}`,
        item: props.item,
        mode: mode.value,
        questionCount: props.item.questions.filter(questionReady).length,
        onBack: () => { mode.value = null; },
        onContinue: (settings: SessionSettings) => { sessionSettings.value = settings; },
      });
      return h(KnowledgeSession, {
        key: `session-${revision.value}-${mode.value}`, item: props.item, mode: mode.value, settings: sessionSettings.value,
        onBack: () => {
          if (mode.value === 'test') mode.value = null;
          else sessionSettings.value = null;
        },
        onBuild: openBuilder,
      });
    }

    return () => h('div', { class: 'knowledge-set-workspace' }, [
      h('header', { class: 'knowledge-set-toolbar' }, [
        h('label', { class: 'knowledge-mode-control' }, ['Mode', h('select', {
          value: mode.value ?? '', disabled: building.value,
          onChange: (event: Event) => { const value = inputValue(event); if (isCheckMode(value)) chooseMode(value);
            if (event.target instanceof HTMLSelectElement) event.target.value = mode.value ?? ''; },
        }, [h('option', { value: '', disabled: true }, 'Choose a mode'), ...CHECK_MODES.map((entry) => h('option', { value: entry.id }, entry.label))])]),
        h('span', { class: 'knowledge-muted' }, `${props.item.questions.length} ${props.item.questions.length === 1 ? 'question' : 'questions'}`),
        h('button', { type: 'button', class: 'quiet-button', disabled: building.value,
          onClick: openBuilder }, 'Build questions'),
      ]),
      h(Transition, {
        name: 'knowledge-workspace-view',
        mode: 'out-in',
        onBeforeLeave: leaveReviewPanel,
        onLeaveCancelled: restoreReviewPanel,
        onAfterEnter: enterReviewPanel,
      }, { default: renderWorkspaceView }),
      message.value ? h('p', { class: 'knowledge-message', role: 'alert' }, message.value) : null,
    ]);
  },
});
