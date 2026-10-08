import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';
import { registerLeaveGuard } from '../../core/leave-guards.ts';
import { answerCorrect, questionReady, questionResponseAnswered, questionScored, type QuestionResponse } from './question-model.ts';
import type { CheckItem } from './library-model.ts';
import type { CheckModeId } from './check-types.ts';
import { answerStrictnessForQuestion, prepareSessionQuestions, sessionQuestionCount, type SessionSettings } from './session-settings.ts';

export function useKnowledgeSession(item: CheckItem, mode: CheckModeId, settings: SessionSettings) {
  const availableQuestions = computed(() => item.questions.filter(questionReady));
  const questions = ref<ReturnType<typeof prepareSessionQuestions>>([]);
  const questionCount = computed(() => sessionQuestionCount(availableQuestions.value.length, settings));
  const options = computed(() => settings);
  const position = ref(0);
  const responses = ref<Record<string, QuestionResponse>>({});
  const feedbackResponses = ref<Record<string, QuestionResponse>>({});
  const checked = ref(new Set<string>());
  const revealed = ref(new Set<string>());
  const hints = ref(new Set<string>());
  const submitted = ref(false);
  const started = ref(false);
  const expired = ref(false);
  const ended = ref(false);
  const now = ref(Date.now());
  const deadline = ref<number | null>(null);
  const celebrating = ref<string | null>(null);
  const attempts = ref<Record<string, number>>({});
  const studyChecks = ref(0);
  const studyCorrectChecks = ref(0);
  const active = computed(() => mode !== 'study' && started.value && !submitted.value);
  const scoredCount = computed(() => questions.value.filter(questionScored).length);
  const answered = computed(() => questions.value.filter(question =>
    questionScored(question) && questionResponseAnswered(question, responses.value[question.id])).length);
  const resolved = computed(() => questions.value.filter(question =>
    !questionScored(question) || checked.value.has(question.id)).length);
  const score = computed(() => questions.value.filter(question =>
    questionScored(question) && answerCorrect(
      question,
      responses.value[question.id] ?? (question.type === 'fill-in-the-blanks' ? [] : ''),
      answerStrictnessForQuestion(settings, question.type),
    )).length);
  const remaining = computed(() => deadline.value === null ? null : Math.max(0, Math.ceil((deadline.value - now.value) / 1000)));
  let timer: number | null = null;
  let celebrationTimer: number | null = null;
  let unregister: (() => void) | null = null;

  function clearCelebration() {
    if (celebrationTimer !== null) window.clearTimeout(celebrationTimer);
    celebrationTimer = null; celebrating.value = null;
  }
  function submit(timedOut = false) {
    expired.value = timedOut; submitted.value = true; deadline.value = null; clearCelebration();
  }
  function tick() {
    now.value = Date.now();
    if (active.value && deadline.value !== null && now.value >= deadline.value) submit(true);
  }
  function start() {
    responses.value = {}; checked.value = new Set(); revealed.value = new Set(); hints.value = new Set(); attempts.value = {};
    feedbackResponses.value = {};
    studyChecks.value = 0; studyCorrectChecks.value = 0;
    questions.value = prepareSessionQuestions(availableQuestions.value, settings);
    position.value = 0; submitted.value = false; expired.value = false; ended.value = false; clearCelebration();
    now.value = Date.now(); started.value = true;
    deadline.value = mode === 'test' && options.value.timeLimitMinutes !== null ? now.value + options.value.timeLimitMinutes * 60_000 : null;
  }
  function end() {
    started.value = false; submitted.value = false; deadline.value = null; ended.value = true; clearCelebration();
    responses.value = {}; checked.value = new Set(); revealed.value = new Set(); hints.value = new Set(); attempts.value = {};
    feedbackResponses.value = {};
    studyChecks.value = 0; studyCorrectChecks.value = 0; questions.value = []; position.value = 0;
  }
  function leave(): boolean {
    tick();
    if (!active.value) return true;
    if (!window.confirm(`Leave this ${mode === 'test' ? 'Test' : 'Quiz'}? This will end your session and discard its answers.`)) return false;
    end(); return true;
  }
  function check() {
    tick();
    if (submitted.value) return;
    const question = questions.value[position.value];
    if (!question) return;
    if (!questionScored(question)) return;
    const response = responses.value[question.id];
    if (question.type !== 'fill-in-the-blanks' && !questionResponseAnswered(question, response)) return;
    // Retry feedback describes the last check, never a newly selected answer.
    feedbackResponses.value[question.id] = Array.isArray(response) ? [...response] : response ?? '';
    const nextAttempt = (attempts.value[question.id] ?? 0) + 1;
    attempts.value[question.id] = nextAttempt;
    const correct = answerCorrect(
      question,
      response ?? (question.type === 'fill-in-the-blanks' ? [] : ''),
      answerStrictnessForQuestion(settings, question.type),
    );

    clearCelebration();
    if (correct && mode !== 'test') {
      celebrating.value = question.id;
      celebrationTimer = window.setTimeout(clearCelebration, 900);
    }

    if (mode === 'study') {
      checked.value.add(question.id);
      studyChecks.value += 1;
      if (correct) studyCorrectChecks.value += 1;
      return;
    }

    if (mode === 'quiz') {
      if (correct || nextAttempt >= options.value.quizAttempts) checked.value.add(question.id);
      return;
    }

    checked.value.add(question.id);
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!active.value) return;
    event.preventDefault(); event.returnValue = '';
  }
  function attach() {
    if (unregister) return;
    unregister = registerLeaveGuard(leave);
    timer = window.setInterval(tick, 250);
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', tick);
    tick();
  }
  function detach() {
    unregister?.(); unregister = null;
    if (timer !== null) window.clearInterval(timer);
    timer = null; clearCelebration();
    window.removeEventListener('beforeunload', beforeUnload);
    document.removeEventListener('visibilitychange', tick);
  }
  onMounted(attach); onActivated(attach);
  onDeactivated(() => { if (active.value || (mode === 'study' && started.value)) end(); detach(); });
  onBeforeUnmount(detach);
  return { questions, questionCount, options, position, responses, feedbackResponses, checked, revealed, hints, submitted, started, expired, ended,
    active, answered, resolved, score, scoredCount, remaining, celebrating, attempts, studyChecks, studyCorrectChecks,
    start, end, check, submit, leave, tick };
}
