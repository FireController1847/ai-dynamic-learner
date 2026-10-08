import type { Tutorial } from '../../packages/tips/src/index.ts';

export const knowledgeCheckTips: Tutorial = {
  version: 4,
  sections: [
    {
      id: 'library',
      title: 'Knowledge sets',
      description: 'Create and organize reusable sets of questions.',
      when: '#knowledge-check-library',
      steps: [
        {
          title: 'One set, three modes',
          body: 'Create a knowledge set here, then build its questions. Use the same set in Study, Quiz, or Test. Groups keep related sets together.',
          target: '#knowledge-check-library',
          targetLabel: 'Knowledge set library',
          placement: 'right',
        },
      ],
    },
    {
      id: 'builder',
      title: 'Build a knowledge set',
      description: 'Add questions, answers, and optional explanations.',
      when: '.knowledge-set-builder .knowledge-question-editor:not(.knowledge-builder-empty)',
      prepare: 'builder',
      auto: false,
      steps: [
        {
          title: 'Organize your questions',
          body: 'Name the set and use Add question to extend it. Select a question in this list to edit it.',
          target: '.knowledge-question-list',
          targetLabel: 'Question list',
          placement: 'right',
        },
        {
          title: 'Set the answer',
          body: 'Choose Multiple Choice, True or False, or Short Answer. Add the prompt, correct answer, and an optional explanation. Save questions when finished; select a correct answer before saving. In Set options, add a description and configure Test timing and answer visibility.',
          target: '.knowledge-set-builder .knowledge-question-editor:not(.knowledge-builder-empty)',
          targetLabel: 'Question editor',
          placement: 'left',
        },
      ],
    },
    {
      id: 'modes',
      title: 'Choose a mode',
      description: 'Choose how to use a knowledge set.',
      when: '.knowledge-check-type-grid',
      prepare: 'mode',
      auto: false,
      steps: [
        {
          title: 'Choose how to learn',
          body: 'Study offers hints and retries without a score. Quiz gives friendly feedback after each answer. Test holds feedback until submission. Once you choose, the Mode dropdown at the top left lets you switch.',
          target: '.knowledge-check-type-grid',
          targetLabel: 'Study, Quiz, and Test',
          placement: 'left',
        },
      ],
    },
    {
      id: 'study',
      title: 'Study',
      description: 'Review answers at your own pace.',
      when: '.knowledge-session[data-mode="study"]',
      prepare: 'study',
      auto: false,
      steps: [
        {
          title: 'Practice with help when needed',
          body: 'Press Start studying on the overview. Answer and check, then retry or use hints when needed. Study does not score you. End studying returns to the overview; starting again creates a fresh practice session.',
          target: ['.knowledge-session[data-mode="study"] .knowledge-prompt', '.knowledge-session-intro[data-mode="study"]'],
          targetLabel: 'Study question',
          placement: 'left',
        },
      ],
    },
    {
      id: 'quiz',
      title: 'Quiz',
      description: 'Practice with feedback after each answer.',
      when: '.knowledge-session[data-mode="quiz"]',
      prepare: 'quiz',
      auto: false,
      steps: [
        {
          title: 'Answer and check',
          body: 'Press Start quiz on the overview. Choose or type an answer, then press Check answer. This locks your response and shows the correct answer and explanation. Next question becomes available after checking; See results gives your score after the last question.',
          target: ['.knowledge-session[data-mode="quiz"] .knowledge-prompt', '.knowledge-session-intro[data-mode="quiz"]'],
          targetLabel: 'Quiz question and feedback',
          placement: 'left',
        },
      ],
    },
    {
      id: 'test',
      title: 'Test',
      description: 'Complete the set before seeing feedback.',
      when: '.knowledge-session[data-mode="test"]',
      prepare: 'test',
      auto: false,
      steps: [
        {
          title: 'Review before submitting',
          body: 'Read the overview, then press Start test. A configured clock starts now. Previous and Next question let you revisit and change responses. On the last question, Submit test ends the session; blank responses count as incorrect. Time expiry submits automatically. Results show your score, with answers and explanations only when enabled in Set options.',
          target: ['.knowledge-session[data-mode="test"] .knowledge-session-navigation', '.knowledge-session-intro[data-mode="test"]'],
          targetLabel: 'Test navigation',
          placement: 'bottom',
        },
      ],
    },
  ],
};
