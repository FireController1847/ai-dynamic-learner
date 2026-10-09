import { defineComponent, h, type PropType } from 'vue';
import type { StatisticsApp, StatisticsMetric } from '../core/statistics.ts';
import { useStatistics } from './statistics-context.ts';

const DEFAULT_METRIC: Record<StatisticsApp, StatisticsMetric> = {
  notebook: 'views', 'todo-list': 'tasksCompleted', 'index-cards': 'reviews',
  'knowledge-check': 'studyPasses', 'word-search': 'gamesCompleted', crossword: 'gamesCompleted',
  guide: 'adventuresCompleted', calculator: 'calculations',
};
function caption(metric: StatisticsMetric, count: number): string {
  const plural = count !== 1;
  switch (metric) {
    case 'reviews': return `${plural ? 'reviews' : 'review'} completed`;
    case 'studyPasses': return `${plural ? 'study passes' : 'study pass'} completed`;
    case 'quizzes': return `${plural ? 'quizzes' : 'quiz'} taken`;
    case 'tests': return `${plural ? 'tests' : 'test'} taken`;
    case 'gamesCompleted': return `${plural ? 'puzzles' : 'puzzle'} completed`;
    case 'adventuresCompleted': return `${plural ? 'adventures' : 'adventure'} completed`;
    case 'tasksCompleted': return `${plural ? 'tasks' : 'task'} completed`;
    case 'cardViews': return `${plural ? 'cards' : 'card'} viewed`;
    case 'views': return `${plural ? 'visits' : 'visit'}`;
    case 'calculations': return `${plural ? 'calculations' : 'calculation'}`;
    default: return metric.replace(/([A-Z])/g, ' $1').toLowerCase();
  }
}

// Small bits of progress belong beside the action they describe, not in a report.
export const EntryStatistics = defineComponent({
  name: 'EntryStatistics',
  props: {
    app: { type: String as PropType<StatisticsApp>, required: true }, id: { type: String, required: true },
    metric: { type: String as PropType<StatisticsMetric | undefined>, default: undefined },
  },
  setup(props) {
    const statistics = useStatistics();
    return () => {
      if (!statistics) return null;
      const counts = statistics.entry(props.app, props.id);
      const metric = props.metric ?? DEFAULT_METRIC[props.app];
      const count = counts[metric] ?? 0;
      return h('span', { class: 'entry-statistics' }, [h('strong', count.toLocaleString()), ` ${caption(metric, count)}`]);
    };
  },
});
