import { defineComponent, h, type PropType } from 'vue';
import type { AiSourceUnit } from '../../core/ai-source-units.ts';
import { questionScored, type Question } from './question-model.ts';
import type { ReviewAttempt } from './attempt-history.ts';

/** Actual per-unit exposures and assessment results, separate from AI coverage claims. */
export const ReviewUnitStatistics = defineComponent({
  name: 'ReviewUnitStatistics',
  props: {
    questions: { type: Array as PropType<readonly Question[]>, required: true },
    sourceUnits: { type: Array as PropType<readonly AiSourceUnit[] | undefined>, default: undefined },
    history: { type: Array as PropType<readonly ReviewAttempt[] | undefined>, default: undefined },
    attempts: { type: Object as PropType<Record<string, number> | undefined>, default: undefined },
  },
  setup(props) {
    return () => {
      const listed = props.sourceUnits?.map(unit => ({ ...unit })) ?? [];
      const used = new Set(listed.map(unit => unit.title.toLocaleLowerCase()));
      for (const question of props.questions) {
        if (!question.sourceUnit || used.has(question.sourceUnit.toLocaleLowerCase())) continue;
        used.add(question.sourceUnit.toLocaleLowerCase());
        listed.push({ kind: 'unit', title: question.sourceUnit, itemNumbers: [], missingTopics: [] });
      }
      if (!listed.length) return null;
      return h('section', { class: 'review-unit-statistics', 'aria-label': 'Study statistics by source unit' }, [
        h('h3', 'Statistics by source unit'),
        h('p', { class: 'knowledge-muted' },
          'These are actual question exposures and recorded quiz/test answers, not AI-estimated source coverage. Previous study sessions are counted only when tracked.'),
        h('ol', listed.map(unit => {
          const bank = props.questions.filter(q => q.sourceUnit === unit.title && questionScored(q));
          const seen = bank.filter(q => (q.shownCount ?? 0) > 0).length;
          const exposures = bank.reduce((sum, q) => sum + (q.shownCount ?? 0), 0);
          const practiced = props.attempts ? bank.filter(q => (props.attempts?.[q.id] ?? 0) > 0).length : null;
          let checked = 0, correct = 0;
          for (const attempt of props.history ?? []) {
            for (const question of attempt.questions) {
              if (question.sourceUnit !== unit.title || !questionScored(question)) continue;
              checked++;
              if (attempt.correctIds.includes(question.id)) correct++;
            }
          }
          return h('li', { key: unit.title }, [
            h('details', [
              h('summary', [h('strong', unit.title), ' · ' + seen + ' / ' + bank.length + ' questions seen']),
              h('p', { class: 'knowledge-muted' }, 'Original ' + unit.kind + ' · ' + bank.length + ' scored questions in this set'),
              h('p', 'Questions displayed at least once: ' + seen + ' of ' + bank.length + '. Total recorded displays: ' + exposures + '.'),
              practiced !== null ? h('p', 'Questions practiced this Study round: ' + practiced + ' of ' + bank.length + '.') : null,
              h('p', checked
                ? 'Recorded Quiz/Test results: ' + correct + ' correct of ' + checked + ' scored answers (' + Math.round(correct / checked * 100) + '%).'
                : 'No Quiz/Test results recorded for this unit.'),
              unit.missingTopics.length ? h('div', [
                h('strong', 'AI-reported source gaps (not verified)'),
                h('ul', unit.missingTopics.map(topic => h('li', topic))),
              ]) : null,
            ]),
          ]);
        })),
      ]);
    };
  },
});
