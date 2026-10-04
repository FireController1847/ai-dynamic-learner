import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { readTipsPreferences, writeTipsPreferences } from './preferences.ts';
import { dispatchTutorialAction } from './tutorial-events.ts';
import type { StepAction, TipSection, TipsProps, TutorialCleanup, TutorialRequest } from './types.ts';
import { useTipsPosition, visibleTarget } from './position.ts';

export function useTips(props: Readonly<TipsProps>) {
  const primaryFocus = ref<HTMLElement | null>(null);
  const openState = ref(false);
  const mode = ref('menu');
  const activeSectionId = ref<string | null>(null);
  const stepIndex = ref(0);
  const preferences = ref(readTipsPreferences(props.storageKey));

  let returnFocus: HTMLElement | null = null;
  let contextObserver: MutationObserver | null = null;
  let autoFrame = 0;
  let returnToMenu = false;
  let activeCleanup: TutorialCleanup | null = null;

  const tutorial = computed(() => props.feature ? props.catalog[props.feature.id] : null);
  const sections = computed(() => tutorial.value?.sections ?? []);
  const activeSection = computed(() =>
    sections.value.find((section) => section.id === activeSectionId.value) ?? null);
  const step = computed(() => activeSection.value?.steps[stepIndex.value] ?? null);
  const { card, targetRect, cardPlacement, cardStyle, dragging, manualPosition, scrims, centeredCardStyle, trackTarget, requestPositionUpdate, updatePosition, beginCardDrag, dragCard, endCardDrag, resetTracking } = useTipsPosition(openState, mode, step);

  function seenKey(section: TipSection | null) {
    return props.feature?.id && section ? `${props.feature.id}:${section.id}` : '';
  }

  function hasSeenSection(section: TipSection | null) {
    const key = seenKey(section);
    return Boolean(key && tutorial.value &&
      preferences.value.seen[key] === tutorial.value.version);
  }

  function markSectionSeen(section = activeSection.value) {
    const key = seenKey(section);
    if (!key || !tutorial.value) return;
    savePreferences({
      ...preferences.value,
      seen: {
        ...preferences.value.seen,
        [key]: tutorial.value.version,
      },
    });
  }

  function savePreferences(nextPreferences: TipsProps extends never ? never : typeof preferences.value) {
    preferences.value = nextPreferences;
    writeTipsPreferences(props.storageKey, nextPreferences);
  }

  function sectionAvailable(section: TipSection) {
    return !section.when || Boolean(visibleTarget(section.when));
  }

  function availableNow(section: TipSection) {
    return sectionAvailable(section);
  }

  function requestTutorialAction(action: string) {
    return new Promise<TutorialCleanup>((resolve, reject) => {
      const detail: TutorialRequest = {
        featureId: props.feature?.id ?? '',
        action,
        handled: false,
        resolve,
        reject,
      };
      dispatchTutorialAction(props.actionEventName, detail);
      if (!detail.handled) reject(new Error('This guide cannot be opened automatically.'));
    });
  }

  async function cleanupActiveDemo() {
    const cleanup = activeCleanup;
    activeCleanup = null;
    if (typeof cleanup !== 'function') return;
    try { await cleanup(); }
    catch (error) { console.warn('TIPS example cleanup failed.', error); }
  }

  async function prepareAndStart(section: TipSection) {
    if (!section?.prepare) return;
    await cleanupActiveDemo();
    try {
      const cleanup = await requestTutorialAction(section.prepare);
      activeCleanup = typeof cleanup === 'function' ? cleanup : null;
      await nextTick();
      await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      if (!sectionAvailable(section)) throw new Error('The requested guide did not open.');
      startSection(section, true);
    } catch (error) {
      await cleanupActiveDemo();
      console.warn('TIPS could not open this guide.', error);
    }
  }

  function open(trigger: EventTarget | null = null) {
    if (!tutorial.value) return;
    returnFocus = trigger instanceof HTMLElement ? trigger : null;
    returnToMenu = false;
    mode.value = 'menu';
    activeSectionId.value = null;
    stepIndex.value = 0;
    targetRect.value = null;
    manualPosition.value = false;
    cardPlacement.value = 'center';
    cardStyle.value = centeredCardStyle();
    openState.value = true;
  }

  function startSection(section: TipSection, fromMenu = false) {
    if (!section || !sectionAvailable(section)) return;
    returnToMenu = fromMenu;
    manualPosition.value = false;
    mode.value = 'tour';
    activeSectionId.value = section.id;
    stepIndex.value = 0;
    openState.value = true;
  }

  async function finishSection() {
    const section = activeSection.value;
    markSectionSeen(section);

    if (section?.finishAction?.click) {
      close();
      await nextTick();
      visibleTarget(section.finishAction.click)?.click();
      await nextTick();
      await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      await cleanupActiveDemo();
      return;
    }

    const continueToAvailable = Boolean(section?.continueToAvailable) && !returnToMenu;
    await cleanupActiveDemo();
    if (returnToMenu) await showMenu();
    else close();

    if (continueToAvailable) {
      await nextTick();
      requestAutoStart();
    }
  }

  async function skipSection() {
    markSectionSeen();
    await cleanupActiveDemo();
    if (returnToMenu) await showMenu();
    else close();
  }

  async function showMenu() {
    await cleanupActiveDemo();
    returnToMenu = false;
    mode.value = 'menu';
    activeSectionId.value = null;
    stepIndex.value = 0;
    trackTarget(null);
    targetRect.value = null;
    manualPosition.value = false;
    cardPlacement.value = 'center';
    cardStyle.value = centeredCardStyle();
    nextTick(() => primaryFocus.value?.focus());
  }

  function close() {
    openState.value = false;
  }

  async function runStepAction(action?: StepAction) {
    if (!action) return true;
    if (action.click) {
      const target = visibleTarget(action.click);
      if (!target) return false;
      target.click();
      await nextTick();
      await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      return true;
    }
    return true;
  }

  async function previous() {
    const currentStep = step.value;
    if (!currentStep || stepIndex.value === 0) return;
    const completed = await runStepAction(currentStep.backAction);
    if (completed) stepIndex.value -= 1;
  }

  async function next() {
    const section = activeSection.value;
    const currentStep = step.value;
    if (!section || !currentStep) return;
    const completed = await runStepAction(currentStep.nextAction);
    if (!completed) return;
    if (stepIndex.value >= section.steps.length - 1) finishSection();
    else stepIndex.value += 1;
  }

  function toggleAutomaticTips() {
    savePreferences({
      ...preferences.value,
      enabled: !preferences.value.enabled,
    });
  }

  function resetCurrentTips() {
    const featureId = props.feature?.id;
    if (!featureId) return;
    const prefix = `${featureId}:`;
    const seen = Object.fromEntries(Object.entries(preferences.value.seen)
      .filter(([key]) => key !== featureId && !key.startsWith(prefix)));
    savePreferences({
      ...preferences.value,
      seen,
    });
  }

  function requestAutoStart() {
    cancelAnimationFrame(autoFrame);
    autoFrame = requestAnimationFrame(maybeAutoStartSection);
  }

  function maybeAutoStartSection() {
    if (openState.value || !preferences.value.enabled || !tutorial.value) return;
    const section = sections.value.find((candidate) =>
      candidate.auto !== false && sectionAvailable(candidate) && !hasSeenSection(candidate));
    if (section) {
      returnFocus = null;
      startSection(section, false);
    }
  }

  function focusPrimaryControl() {
    nextTick(() => primaryFocus.value?.focus());
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !openState.value || mode.value !== 'tour') return;
    event.preventDefault();
    event.stopPropagation();
    skipSection();
  }

  function installGlobalTracking() {
    window.addEventListener('resize', requestPositionUpdate);
    document.addEventListener('scroll', requestPositionUpdate, true);
    document.addEventListener('keydown', handleKeydown, true);

    const appLayout = document.querySelector('.app-layout');
    if (appLayout && window.MutationObserver) {
      contextObserver = new MutationObserver(() => {
        if (openState.value && mode.value === 'tour') requestPositionUpdate();
        else requestAutoStart();
      });
      contextObserver.observe(appLayout, { childList: true, subtree: true, attributes: true });
    }
  }

  function removeGlobalTracking() {
    window.removeEventListener('resize', requestPositionUpdate);
    document.removeEventListener('scroll', requestPositionUpdate, true);
    document.removeEventListener('keydown', handleKeydown, true);
    contextObserver?.disconnect();
    resetTracking();
    cancelAnimationFrame(autoFrame);
    autoFrame = 0;
  }

  watch(openState, async (isOpen) => {
    if (isOpen) {
      await nextTick();
      if (mode.value === 'tour') updatePosition();
      focusPrimaryControl();
    } else {
      trackTarget(null);
      targetRect.value = null;
      await nextTick();
      const target = returnFocus;
      returnFocus = null;
      if (target?.isConnected) target.focus();
    }
  });

  watch(stepIndex, async () => {
    if (!openState.value || mode.value !== 'tour') return;
    manualPosition.value = false;
    await nextTick();
    updatePosition();
    focusPrimaryControl();
  });

  watch(activeSectionId, async () => {
    if (!openState.value || mode.value !== 'tour') return;
    manualPosition.value = false;
    await nextTick();
    updatePosition();
    focusPrimaryControl();
  });

  watch(() => props.feature?.id, async () => {
    await cleanupActiveDemo();
    openState.value = false;
    mode.value = 'menu';
    activeSectionId.value = null;
    stepIndex.value = 0;
    returnFocus = null;
    await nextTick();
    requestAutoStart();
  }, { immediate: true });

  onMounted(() => {
    installGlobalTracking();
    requestAutoStart();
  });
  onBeforeUnmount(() => {
    cleanupActiveDemo();
    removeGlobalTracking();
  });

  return { primaryFocus, openState, mode, stepIndex, preferences, tutorial, sections, activeSection, step, card, targetRect, cardPlacement, cardStyle, dragging, manualPosition, scrims, centeredCardStyle, beginCardDrag, dragCard, endCardDrag, hasSeenSection, availableNow, prepareAndStart, open, startSection, skipSection, showMenu, close, previous, next, toggleAutomaticTips, resetCurrentTips };
}
