import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { useStatistics } from '../../components/statistics-context.ts';
import { registerLeaveGuard } from '../../core/leave-guards.ts';
import { answerCorrect, cloneQuestion, questionReady, questionResponseAnswered, questionScored, type Question, type QuestionResponse } from './question-model.ts';
import type { GeneratedVariant } from '../../core/parameterized/generator.ts';
import { newVariantSeed } from '../../core/parameterized/random.ts';
import { readSession, writeSession, sessionStorageKey, sessionVariant, type ParameterizedSessionSnapshot } from './parameterized-session.ts';
import type { CheckItem } from './library-model.ts';
import type { CheckModeId } from './check-types.ts';
import { answerStrictnessForQuestion, prepareSessionQuestions, sessionQuestionCount, type SessionSettings } from './session-settings.ts';

export function useKnowledgeSession(item: CheckItem, mode: CheckModeId, settings: SessionSettings, statisticsEnabled = true) {
  const context = useStatistics();
  const statistics = statisticsEnabled ? context : null;
  let studyVisited = new Set<string>();
  let studyPassRecorded = false;
  const availableQuestions = computed(() => item.questions.filter(questionReady));
  const questions = ref<ReturnType<typeof prepareSessionQuestions>>([]);
  const questionCount = computed(() => sessionQuestionCount(availableQuestions.value.length, settings));
  const runtimeSettings = ref({ ...settings });
  const options = computed(() => runtimeSettings.value);
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
      answerStrictnessForQuestion(options.value, question.type),
    )).length);
  const remaining = computed(() => deadline.value === null ? null : Math.max(0, Math.ceil((deadline.value - now.value) / 1000)));
  let timer: number | null = null;
  let celebrationTimer: number | null = null;
  let unregister: (() => void) | null = null;

  const generationError = ref('');
  const generating = ref(false);
  const submitting = ref(false);
  let generationController = new AbortController();
  let epoch = 0;
  let instances: Record<string, GeneratedVariant> = {};
  const inFlight = new Map<string, Promise<boolean>>();
  const storageMessage = ref('');
  const resumable = ref(false);
  const storageKey = sessionStorageKey(item.id, mode);
  let templates: Question[] = [];
  let seeds: Record<string, string> = {};
  let saved: ParameterizedSessionSnapshot | null = null;
  const generatedIds = new Set<string>();
  const lastSignatures = new Map<string, string>();
  const signature = (question: Question) => JSON.stringify([question.type, question.prompt, question.context,
    question.explanation, question.answer, [...question.choices].sort(), question.matches,
    question.generated?.answers.map(answer => [answer.key, answer.label, answer.text, answer.value])]);
  try { if (statisticsEnabled) { saved = readSession(storageKey); resumable.value = Boolean(saved); } }
  catch (error) { storageMessage.value = `Saved session unavailable: ${error instanceof Error ? error.message : String(error)}`; }
  function persist() {
    if (!statisticsEnabled || !started.value || !templates.some(question => question.type === 'parameterized')) return;
    try {
      saved = { version: 1, templates, instances: { ...instances }, seeds: { ...seeds }, settings: { ...options.value }, position: position.value,
        responses: { ...responses.value }, feedbackResponses: { ...feedbackResponses.value }, checked: [...checked.value],
        revealed: [...revealed.value], hints: [...hints.value], attempts: { ...attempts.value }, submitted: submitted.value,
        expired: expired.value, deadline: deadline.value, studyChecks: studyChecks.value, studyCorrectChecks: studyCorrectChecks.value,
        studyVisited: [...studyVisited], studyPassRecorded };
      writeSession(storageKey, saved); resumable.value = true; storageMessage.value = '';
    } catch (error) { storageMessage.value = `Session could not be saved: ${error instanceof Error ? error.message : String(error)}`; }
  }
  function ensureQuestion(index: number, fresh = false): Promise<boolean> {
    const template = templates[index];
    if (!template || generatedIds.has(template.id)) return Promise.resolve(true);
    const pending = inFlight.get(template.id); if (pending) return pending;
    const currentEpoch = epoch, controller = generationController;
    generating.value = true;
    const task = (async () => {
      try {
        let question = await sessionVariant(template, seeds[template.id]!, options.value.shuffleChoices, controller.signal, instances[template.id]);
        if (fresh && template.type === 'parameterized' && !instances[template.id]) {
          const previous = lastSignatures.get(template.id);
          for (let retry = 0; previous && signature(question) === previous && retry < 8; retry++) {
            if (epoch !== currentEpoch) return false;
            seeds[template.id] = newVariantSeed();
            question = await sessionVariant(template, seeds[template.id]!, options.value.shuffleChoices, controller.signal);
          }
        }
        if (epoch !== currentEpoch || controller.signal.aborted) return false;
        questions.value[index] = question; generatedIds.add(template.id);
        if (question.generated) { instances[template.id] = question.generated; lastSignatures.set(template.id, signature(question)); }
        generationError.value = ''; persist(); return true;
      } catch (error) {
        if (epoch === currentEpoch && !controller.signal.aborted) generationError.value = `Question ${index + 1}: ${error instanceof Error ? error.message : String(error)}`;
        return false;
      } finally {
        if (epoch === currentEpoch) { inFlight.delete(template.id); generating.value = inFlight.size > 0; }
      }
    })();
    inFlight.set(template.id, task); return task;
  }
  function resetGeneration() {
    generationController.abort(); generationController = new AbortController(); epoch++;
    inFlight.clear(); generatedIds.clear(); generating.value = false; submitting.value = false; generationError.value = '';
  }
  async function resume() {
    if (!saved) return;
    const snapshot = saved;
    resetGeneration(); instances = { ...snapshot.instances };
    runtimeSettings.value = { ...snapshot.settings }; templates = snapshot.templates.map(cloneQuestion);
    seeds = { ...snapshot.seeds }; questions.value = templates.map(cloneQuestion); generatedIds.clear();
    position.value = snapshot.position;
    // Resolve all visited questions and submitted results using their original seeds.
    const visited = new Set([...snapshot.checked, ...snapshot.revealed, ...snapshot.hints, ...Object.keys(snapshot.responses), ...snapshot.studyVisited]);
    for (let index = 0; index < templates.length; index++) {
      if ((snapshot.submitted || options.value.presentation === 'scroll' ||
        visited.has(templates[index]!.id) || index === snapshot.position) && !await ensureQuestion(index)) return;
    }
    responses.value = { ...snapshot.responses }; feedbackResponses.value = { ...snapshot.feedbackResponses };
    checked.value = new Set(snapshot.checked); revealed.value = new Set(snapshot.revealed); hints.value = new Set(snapshot.hints);
    attempts.value = { ...snapshot.attempts }; studyChecks.value = snapshot.studyChecks; studyCorrectChecks.value = snapshot.studyCorrectChecks;
    studyVisited = new Set(snapshot.studyVisited); studyPassRecorded = snapshot.studyPassRecorded;
    submitted.value = snapshot.submitted; expired.value = snapshot.expired; deadline.value = snapshot.deadline;
    ended.value = false; started.value = true; tick();
  }
  watch([responses, feedbackResponses, checked, revealed, hints, attempts, position, submitted, deadline, studyChecks, studyCorrectChecks], persist, { deep: true });

  function clearCelebration() {
    if (celebrationTimer !== null) window.clearTimeout(celebrationTimer);
    celebrationTimer = null; celebrating.value = null;
  }
  async function submit(timedOut = false) {
    if (submitted.value || submitting.value || !started.value) return;
    const currentEpoch = epoch; submitting.value = true;
    try {
      for (let index = 0; index < templates.length; index++) {
        if (!await ensureQuestion(index)) { if (epoch === currentEpoch) { deadline.value = null; persist(); } return; }
      }
      if (currentEpoch !== epoch) return;
      if (mode !== 'study') {
        statistics?.record('knowledge-check', item.id, mode === 'quiz' ? 'quizzes' : 'tests');
        statistics?.record('knowledge-check', item.id, 'assessmentQuestions', scoredCount.value);
        statistics?.record('knowledge-check', item.id, 'assessmentCorrect', score.value);
      }
      expired.value = timedOut; submitted.value = true; deadline.value = null; clearCelebration(); persist();
    } finally { if (currentEpoch === epoch) submitting.value = false; }
  }
  function resetStudyPass() {
    studyVisited = new Set(questions.value[position.value] ? [questions.value[position.value]!.id] : []);
    studyPassRecorded = false; persist();
  }
  function finishStudyPass() {
    if (mode === 'study' && started.value && questions.value.length &&
        studyVisited.size === questions.value.length && !studyPassRecorded) {
      statistics?.record('knowledge-check', item.id, 'studyPasses');
      studyPassRecorded = true; persist();
    }
  }
  function completeStudyScrollPass() {
    if (mode !== 'study' || options.value.presentation !== 'scroll' || !started.value) return;
    // Reaching Keep studying at the end of the list completes one pass without grading anything.
    studyVisited = new Set(questions.value.map(question => question.id));
    finishStudyPass();
  }
  watch(position, async () => {
    const index = position.value, currentEpoch = epoch;
    if (!started.value || !await ensureQuestion(index, true) || currentEpoch !== epoch) return;
    if (mode === 'study' && started.value && questions.value[index]) studyVisited.add(questions.value[index]!.id);
    persist();
  }, { flush: 'sync' });
  function tick() {
    now.value = Date.now();
    if (!generationError.value && active.value && deadline.value !== null && now.value >= deadline.value) submit(true);
  }
  async function start() {
    if (generating.value || submitting.value) return;
    resetGeneration(); started.value = false;
    responses.value = {}; checked.value = new Set(); revealed.value = new Set(); hints.value = new Set(); attempts.value = {};
    feedbackResponses.value = {};
    studyChecks.value = 0; studyCorrectChecks.value = 0;
    runtimeSettings.value = { ...settings };
    // Recover the previous run's values solely to avoid an unnecessary repeat.
    for (const template of saved?.templates ?? []) {
      if (template.type === 'parameterized') {
        try { const previous = saved!.instances?.[template.id] ? await sessionVariant(template, saved!.seeds[template.id]!, false, generationController.signal, saved!.instances[template.id]) : null;
          if (previous) lastSignatures.set(template.id, signature(previous)); } catch { /* A removed solver cannot block a new run. */ }
      }
    }
    templates = prepareSessionQuestions(availableQuestions.value, { ...settings, shuffleChoices: false }).map(cloneQuestion);
    instances = {};
    seeds = Object.fromEntries(templates.map(question => [question.id, newVariantSeed()])); generatedIds.clear();
    questions.value = templates.map(cloneQuestion);
    if (!await ensureQuestion(0, true)) return;
    if (settings.presentation === 'scroll') {
      for (let index = 1; index < templates.length; index++) {
        if (!await ensureQuestion(index, true)) return;
      }
    }
    position.value = 0; submitted.value = false; expired.value = false; ended.value = false; clearCelebration();
    now.value = Date.now(); started.value = true;
    if (mode === 'study') statistics?.record('knowledge-check', item.id, 'studyStarts');
    resetStudyPass();
    deadline.value = mode === 'test' && options.value.timeLimitMinutes !== null ? now.value + options.value.timeLimitMinutes * 60_000 : null;
    persist();
  }
  function end() {
    finishStudyPass(); resetGeneration(); instances = {};
    try { if (statisticsEnabled) localStorage.removeItem(storageKey); } catch { storageMessage.value = 'Saved session could not be cleared.'; }
    saved = null; resumable.value = false; generationError.value = '';
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
  function check(index = position.value) {
    tick();
    if (submitted.value || submitting.value || generating.value) return;
    const question = questions.value[index];
    if (!question) return;
    if (!questionScored(question) || (mode === 'quiz' && checked.value.has(question.id))) return;
    const response = responses.value[question.id];
    if (question.type !== 'fill-in-the-blanks' && !questionResponseAnswered(question, response)) return;
    // Retry feedback describes the last check, never a newly selected answer.
    feedbackResponses.value[question.id] = Array.isArray(response) ? [...response] : response ?? '';
    const nextAttempt = (attempts.value[question.id] ?? 0) + 1;
    attempts.value[question.id] = nextAttempt;
    const correct = answerCorrect(
      question,
      response ?? (question.type === 'fill-in-the-blanks' ? [] : ''),
      answerStrictnessForQuestion(options.value, question.type),
    );

    clearCelebration();
    statistics?.record('knowledge-check', item.id, 'answerChecks');
    if (correct) statistics?.record('knowledge-check', item.id, 'correctChecks');
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
    persist();
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
  onDeactivated(() => { if (templates.some(question => question.type === 'parameterized')) persist();
    else if (active.value || (mode === 'study' && started.value)) end(); detach(); });
  onBeforeUnmount(() => { finishStudyPass(); persist(); resetGeneration(); detach(); });
  return { questions, questionCount, options, position, responses, feedbackResponses, checked, revealed, hints, submitted, started, expired, ended,
    active, answered, resolved, score, scoredCount, remaining, celebrating, attempts, studyChecks, studyCorrectChecks,
    generationError, generating, submitting, storageMessage, resumable, resume,
    start, end, check, submit, leave, tick, finishStudyPass, completeStudyScrollPass, resetStudyPass };
}
