import { CHECK_MODES, type CheckModeId } from './check-types.ts';
import { Icon } from '../../components/icon.ts';
import { EntryStatistics } from '../../components/entry-statistics.ts';
import { defineComponent, h } from 'vue';
import { reviewChoiceScreen } from './choice-screen.ts';

export const ModePicker = defineComponent({
  name: 'KnowledgeModePicker',
  props: {
    setName: { type: String, required: true },
    statisticsId: { type: String, required: true },
    pausedStudy: Boolean,
    pausedQuiz: Boolean,
    historyCount: { type: Number, default: 0 },
  },
  emits: {
    choose: (_mode: CheckModeId) => true, build: () => true,
    history: () => true, publish: () => true,
  },
  setup(props, { emit }) {
    return () => reviewChoiceScreen({
      eyebrow: 'One knowledge set', title: props.setName,
      description: 'Pick a way to use your questions. You can change it later.',
      choices: CHECK_MODES.map(mode => ({
        id: mode.id, icon: mode.icon,
        label: mode.id === 'study' && props.pausedStudy ? 'Resume Study' :
          mode.id === 'quiz' && props.pausedQuiz ? 'Resume Quiz' : mode.label,
        description: (mode.id === 'study' && props.pausedStudy) || (mode.id === 'quiz' && props.pausedQuiz)
          ? 'Continue your saved session where you left off.' : mode.description,
        detail: h(EntryStatistics, {
          app: 'knowledge-check', id: props.statisticsId,
          metric: mode.id === 'study' ? 'studyPasses' : mode.id === 'quiz' ? 'quizzes' : 'tests',
        }),
      })),
      onChoose: mode => emit('choose', mode),
      footer: h('div', { class: 'knowledge-check-builder-actions knowledge-history-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('history') },
          [h(Icon, { name: 'clock' }), 'History (' + props.historyCount + ')']),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('publish') },
          [h(Icon, { name: 'printer' }), 'Publish']),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('build') },
          [h(Icon, { name: 'pencil' }), 'Build']),
      ]),
    });
  },
});
