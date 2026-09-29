import { tipsCatalog } from './tips-content.js';

const { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } = window.Vue;

const STORAGE_KEY = 'dynamic-learner.tips.v1';
const TIPS_ACTION_EVENT = 'dynamic-learner:tips-action';
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 12;

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      enabled: stored.enabled !== false,
      seen: stored.seen && typeof stored.seen === 'object' && !Array.isArray(stored.seen)
        ? { ...stored.seen }
        : {},
    };
  } catch {
    return { enabled: true, seen: {} };
  }
}

function writePreferences(preferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); }
  catch { /* TIPS preferences are best-effort only. */ }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function selectorList(target) {
  if (!target) return [];
  return Array.isArray(target) ? target : [target];
}

function visibleTarget(selectors) {
  for (const selector of selectorList(selectors)) {
    for (const element of document.querySelectorAll(selector)) {
      if (element.closest('[aria-hidden="true"], [inert]')) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
          style.visibility !== 'hidden') return element;
    }
  }
  return null;
}

export const TipsExperience = {
  name: 'TipsExperience',
  props: {
    feature: { type: Object, default: null },
  },
  setup(props, { expose }) {
    const card = ref(null);
    const primaryFocus = ref(null);
    const openState = ref(false);
    const mode = ref('menu');
    const activeSectionId = ref(null);
    const stepIndex = ref(0);
    const preferences = ref(readPreferences());
    const targetRect = ref(null);
    const cardPlacement = ref('center');
    const cardStyle = ref(centeredCardStyle());
    const dragging = ref(false);

    let returnFocus = null;
    let currentTarget = null;
    let resizeObserver = null;
    let contextObserver = null;
    let updateFrame = 0;
    let autoFrame = 0;
    let returnToMenu = false;
    let manualPosition = false;
    let dragPointerId = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let activeCleanup = null;

    const tutorial = computed(() => tipsCatalog[props.feature?.id] ?? null);
    const sections = computed(() => tutorial.value?.sections ?? []);
    const activeSection = computed(() =>
      sections.value.find((section) => section.id === activeSectionId.value) ?? null);
    const step = computed(() => activeSection.value?.steps[stepIndex.value] ?? null);
    const hasSpotlight = computed(() => Boolean(targetRect.value));

    const scrims = computed(() => {
      const rect = targetRect.value;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (!rect) return [{ top: 0, left: 0, width, height }];
      return [
        { top: 0, left: 0, width, height: rect.top },
        { top: rect.bottom, left: 0, width, height: Math.max(0, height - rect.bottom) },
        { top: rect.top, left: 0, width: rect.left, height: Math.max(0, rect.bottom - rect.top) },
        { top: rect.top, left: rect.right, width: Math.max(0, width - rect.right), height: Math.max(0, rect.bottom - rect.top) },
      ];
    });

    function centeredCardStyle() {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    function seenKey(section) {
      return props.feature?.id && section ? `${props.feature.id}:${section.id}` : '';
    }

    function hasSeenSection(section) {
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

    function savePreferences(nextPreferences) {
      preferences.value = nextPreferences;
      writePreferences(nextPreferences);
    }

    function sectionAvailable(section) {
      return !section.when || Boolean(visibleTarget(section.when));
    }

    function availableNow(section) {
      return sectionAvailable(section);
    }

    function requestTutorialAction(action) {
      return new Promise((resolve, reject) => {
        const detail = {
          featureId: props.feature?.id,
          action,
          handled: false,
          resolve,
          reject,
        };
        window.dispatchEvent(new CustomEvent(TIPS_ACTION_EVENT, { detail }));
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

    async function prepareAndStart(section) {
      if (!section?.prepare) return;
      await cleanupActiveDemo();
      try {
        const cleanup = await requestTutorialAction(section.prepare);
        activeCleanup = typeof cleanup === 'function' ? cleanup : null;
        await nextTick();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (!sectionAvailable(section)) throw new Error('The requested guide did not open.');
        startSection(section, true);
      } catch (error) {
        await cleanupActiveDemo();
        console.warn('TIPS could not open this guide.', error);
      }
    }

    function open(trigger = null) {
      if (!tutorial.value) return;
      returnFocus = trigger;
      returnToMenu = false;
      mode.value = 'menu';
      activeSectionId.value = null;
      stepIndex.value = 0;
      targetRect.value = null;
      manualPosition = false;
      cardPlacement.value = 'center';
      cardStyle.value = centeredCardStyle();
      openState.value = true;
    }

    function startSection(section, fromMenu = false) {
      if (!section || !sectionAvailable(section)) return;
      returnToMenu = fromMenu;
      manualPosition = false;
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
        await new Promise((resolve) => requestAnimationFrame(resolve));
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
      manualPosition = false;
      cardPlacement.value = 'center';
      cardStyle.value = centeredCardStyle();
      nextTick(() => primaryFocus.value?.focus());
    }

    function close() {
      openState.value = false;
    }

    async function runStepAction(action) {
      if (!action) return true;
      if (action.click) {
        const target = visibleTarget(action.click);
        if (!target) return false;
        target.click();
        await nextTick();
        await new Promise((resolve) => requestAnimationFrame(resolve));
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

    function requestPositionUpdate() {
      cancelAnimationFrame(updateFrame);
      updateFrame = requestAnimationFrame(updatePosition);
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

    function trackTarget(element) {
      if (element === currentTarget) return;
      resizeObserver?.disconnect();
      currentTarget = element;
      if (currentTarget && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(requestPositionUpdate);
        resizeObserver.observe(currentTarget);
      }
    }

    function spotlightRect(element) {
      const source = element.getBoundingClientRect();
      const left = clamp(source.left - SPOTLIGHT_PADDING, 0, window.innerWidth);
      const top = clamp(source.top - SPOTLIGHT_PADDING, 0, window.innerHeight);
      const right = clamp(source.right + SPOTLIGHT_PADDING, 0, window.innerWidth);
      const bottom = clamp(source.bottom + SPOTLIGHT_PADDING, 0, window.innerHeight);
      return {
        left, top, right, bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    }

    function overlapArea(first, second) {
      const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
      const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      return width * height;
    }

    function candidatePosition(rect, placement, cardWidth, cardHeight) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - cardWidth - VIEWPORT_MARGIN);
      const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN);
      const centerX = (rect.left + rect.right) / 2;
      const centerY = (rect.top + rect.bottom) / 2;
      let left;
      let top;

      if (placement === 'right') {
        left = rect.right + CARD_GAP;
        top = centerY - cardHeight / 2;
      } else if (placement === 'left') {
        left = rect.left - CARD_GAP - cardWidth;
        top = centerY - cardHeight / 2;
      } else if (placement === 'bottom') {
        left = centerX - cardWidth / 2;
        top = rect.bottom + CARD_GAP;
      } else if (placement === 'top') {
        left = centerX - cardWidth / 2;
        top = rect.top - CARD_GAP - cardHeight;
      } else {
        left = (viewportWidth - cardWidth) / 2;
        top = (viewportHeight - cardHeight) / 2;
      }

      left = clamp(left, VIEWPORT_MARGIN, maxLeft);
      top = clamp(top, VIEWPORT_MARGIN, maxTop);
      return {
        placement,
        left,
        top,
        right: left + cardWidth,
        bottom: top + cardHeight,
      };
    }

    function clampManualCard() {
      const element = card.value;
      if (!element || !manualPosition) return;
      const bounds = element.getBoundingClientRect();
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - bounds.width - VIEWPORT_MARGIN);
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - bounds.height - VIEWPORT_MARGIN);
      cardStyle.value = {
        top: `${Math.round(clamp(bounds.top, VIEWPORT_MARGIN, maxTop))}px`,
        left: `${Math.round(clamp(bounds.left, VIEWPORT_MARGIN, maxLeft))}px`,
        transform: 'none',
      };
    }

    function positionCard(rect) {
      const element = card.value;
      if (!element || !rect) {
        cardPlacement.value = 'center';
        cardStyle.value = centeredCardStyle();
        return;
      }
      if (manualPosition) {
        clampManualCard();
        return;
      }

      const bounds = element.getBoundingClientRect();
      const cardWidth = bounds.width;
      const cardHeight = bounds.height;
      const compact = window.innerWidth <= 560;
      const targetCenterY = (rect.top + rect.bottom) / 2;
      const compactPrimary = targetCenterY < window.innerHeight / 2 ? 'bottom' : 'top';
      const preferred = compact ? compactPrimary : step.value?.placement;
      const placements = compact
        ? [compactPrimary, compactPrimary === 'bottom' ? 'top' : 'bottom']
        : [preferred, 'right', 'left', 'bottom', 'top']
          .filter((value, index, values) => value && values.indexOf(value) === index);

      const fits = {
        right: window.innerWidth - rect.right - CARD_GAP - VIEWPORT_MARGIN >= cardWidth,
        left: rect.left - CARD_GAP - VIEWPORT_MARGIN >= cardWidth,
        bottom: window.innerHeight - rect.bottom - CARD_GAP - VIEWPORT_MARGIN >= cardHeight,
        top: rect.top - CARD_GAP - VIEWPORT_MARGIN >= cardHeight,
      };

      let choice = placements.find((placement) => fits[placement]);
      if (!choice) {
        const center = candidatePosition(rect, 'center', cardWidth, cardHeight);
        const centerOverlap = overlapArea(center, rect);

        if (centerOverlap === 0) {
          choice = 'center';
        } else {
          const alternatives = placements.map((placement, index) => {
            const candidate = candidatePosition(rect, placement, cardWidth, cardHeight);
            return {
              ...candidate,
              overlap: overlapArea(candidate, rect),
              preference: index,
            };
          });
          alternatives.sort((a, b) => a.overlap - b.overlap || a.preference - b.preference);
          choice = alternatives[0]?.placement ?? 'center';
        }
      }

      const candidate = candidatePosition(rect, choice, cardWidth, cardHeight);
      cardPlacement.value = choice;
      cardStyle.value = {
        top: `${Math.round(candidate.top)}px`,
        left: `${Math.round(candidate.left)}px`,
        transform: 'none',
      };
    }

    function beginCardDrag(event) {
      if (event.button !== 0 || event.target.closest('button, a, input, select, textarea')) return;
      const element = card.value;
      if (!element) return;

      const bounds = element.getBoundingClientRect();
      manualPosition = true;
      dragging.value = true;
      dragPointerId = event.pointerId;
      dragOffsetX = event.clientX - bounds.left;
      dragOffsetY = event.clientY - bounds.top;
      cardPlacement.value = 'manual';
      cardStyle.value = {
        top: `${Math.round(bounds.top)}px`,
        left: `${Math.round(bounds.left)}px`,
        transform: 'none',
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function dragCard(event) {
      if (!dragging.value || event.pointerId !== dragPointerId || !card.value) return;
      const bounds = card.value.getBoundingClientRect();
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - bounds.width - VIEWPORT_MARGIN);
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - bounds.height - VIEWPORT_MARGIN);
      cardStyle.value = {
        top: `${Math.round(clamp(event.clientY - dragOffsetY, VIEWPORT_MARGIN, maxTop))}px`,
        left: `${Math.round(clamp(event.clientX - dragOffsetX, VIEWPORT_MARGIN, maxLeft))}px`,
        transform: 'none',
      };
    }

    function endCardDrag(event) {
      if (!dragging.value || event.pointerId !== dragPointerId) return;
      dragging.value = false;
      dragPointerId = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function updatePosition() {
      if (!openState.value) return;
      if (manualPosition && mode.value !== 'tour') {
        clampManualCard();
        return;
      }
      if (mode.value !== 'tour') return;
      const element = visibleTarget(step.value?.target);
      trackTarget(element);

      if (!element) {
        targetRect.value = null;
        if (manualPosition) clampManualCard();
        else positionCard(null);
        return;
      }

      let rect = element.getBoundingClientRect();
      const outside = rect.bottom < 0 || rect.top > window.innerHeight ||
        rect.right < 0 || rect.left > window.innerWidth;
      if (outside) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        rect = element.getBoundingClientRect();
      }

      targetRect.value = spotlightRect(element);
      positionCard(targetRect.value);
    }

    function focusPrimaryControl() {
      nextTick(() => primaryFocus.value?.focus());
    }

    function handleKeydown(event) {
      if (event.key !== 'Escape' || !openState.value) return;
      event.preventDefault();
      event.stopPropagation();
      if (mode.value === 'menu') close();
      else skipSection();
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
      resizeObserver?.disconnect();
      contextObserver = null;
      resizeObserver = null;
      currentTarget = null;
      cancelAnimationFrame(updateFrame);
      cancelAnimationFrame(autoFrame);
      updateFrame = 0;
      autoFrame = 0;
      targetRect.value = null;
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
      manualPosition = false;
      await nextTick();
      updatePosition();
      focusPrimaryControl();
    });

    watch(activeSectionId, async () => {
      if (!openState.value || mode.value !== 'tour') return;
      manualPosition = false;
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

    expose({ open });

    function progressDots(section) {
      return h('div', {
        class: 'tips-progress',
        role: 'progressbar',
        'aria-label': `Step ${stepIndex.value + 1} of ${section.steps.length}`,
        'aria-valuemin': 1,
        'aria-valuemax': section.steps.length,
        'aria-valuenow': stepIndex.value + 1,
      }, section.steps.map((_, index) => h('span', {
        key: index,
        class: ['tips-progress-dot', {
          active: index === stepIndex.value,
          complete: index < stepIndex.value,
        }],
      })));
    }

    function menuContent() {
      let firstAvailableAssigned = false;
      return [
        h('div', { class: 'tips-menu-intro' }, [
          h('h2', { id: 'tips-heading' }, `${props.feature.label} tips`),
        ]),
        h('div', { class: 'tips-section-list' }, sections.value.map((section) => {
          const available = availableNow(section);
          const canPrepare = Boolean(section.prepare);
          const seen = hasSeenSection(section);
          const canOpen = available || canPrepare;
          const assignFocus = canOpen && !firstAvailableAssigned;
          if (assignFocus) firstAvailableAssigned = true;
          return h('button', {
            key: section.id,
            ref: assignFocus ? primaryFocus : undefined,
            type: 'button',
            class: 'tips-section-choice',
            disabled: !canOpen,
            onClick: () => available ? startSection(section, true) : prepareAndStart(section),
          }, [
            h('span', { class: 'tips-section-choice-copy' }, [
              h('strong', section.title),
              h('span', section.description),
            ]),
            h('span', {
              class: ['tips-section-state', {
                complete: seen,
                'is-action': !seen && !available && canPrepare,
              }],
            }, seen
              ? 'Done · Show again'
              : !available
                ? canPrepare ? 'Open for me' : 'Open this screen first'
                : 'Start'),
          ]);
        })),
        h('div', { class: 'tips-menu-reset' }, [
          h('button', {
            type: 'button',
            class: 'delete-confirm-button tips-reset-button',
            onClick: resetCurrentTips,
          }, 'Reset tips'),
        ]),
      ];
    }

    function tourContent() {
      const section = activeSection.value;
      const currentStep = step.value;
      if (!section || !currentStep) return null;
      return [
        h('div', { class: 'tips-body' }, [
          progressDots(section),
          h('h2', { id: 'tips-heading' }, currentStep.title),
          h('p', { id: 'tips-copy', class: 'tips-copy' }, currentStep.body),
        ]),
      ];
    }

    function moreMenu() {
      return h('details', { class: 'tips-more' }, [
        h('summary', 'More'),
        h('div', { class: 'tips-more-menu' }, [
          h('button', {
            type: 'button',
            class: 'quiet-button',
            onClick: showMenu,
          }, 'All guides'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            onClick: toggleAutomaticTips,
          }, preferences.value.enabled ? 'Stop automatic tips' : 'Show tips automatically'),
        ]),
      ]);
    }

    return () => {
      if (!openState.value || !tutorial.value || !props.feature) return null;
      const isMenu = mode.value === 'menu';
      const section = activeSection.value;
      const currentStep = step.value;
      const isLastStep = !isMenu && section && stepIndex.value === section.steps.length - 1;
      const spotlight = !isMenu ? targetRect.value : null;

      return h('div', { class: 'tips-layer' }, [
        ...scrims.value.map((bounds, index) => h('div', {
          key: `scrim-${index}`,
          class: 'tips-scrim',
          'aria-hidden': 'true',
          style: {
            top: `${bounds.top}px`,
            left: `${bounds.left}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
          },
          onClick: isMenu ? close : skipSection,
        })),
        spotlight ? h('div', {
          class: 'tips-spotlight',
          'aria-hidden': 'true',
          style: {
            top: `${spotlight.top}px`,
            left: `${spotlight.left}px`,
            width: `${spotlight.width}px`,
            height: `${spotlight.height}px`,
          },
        }) : null,
        h('section', {
          ref: card,
          class: ['tips-card', {
            'is-centered': (isMenu && !manualPosition) || cardPlacement.value === 'center',
            'is-menu': isMenu,
            'is-dragging': dragging.value,
          }],
          role: 'dialog',
          'aria-labelledby': 'tips-heading',
          'data-placement': isMenu ? 'center' : cardPlacement.value,
          style: isMenu && !manualPosition ? centeredCardStyle() : cardStyle.value,
        }, [
          h('header', {
            class: 'tips-header',
            title: 'Drag to move',
            onPointerdown: beginCardDrag,
            onPointermove: dragCard,
            onPointerup: endCardDrag,
            onPointercancel: endCardDrag,
          }, [
            h('span', { class: 'tips-drag-handle', 'aria-hidden': 'true' }, '•••'),
            h('button', {
              type: 'button',
              class: 'quiet-button tips-skip',
              onClick: isMenu ? close : skipSection,
            }, isMenu ? 'Close' : 'Skip'),
          ]),
          ...(isMenu ? menuContent() : tourContent()),
          !isMenu ? h('footer', { class: 'tips-footer' }, [
            moreMenu(),
            h('div', { class: 'tips-navigation' }, [
              stepIndex.value > 0 && currentStep?.back !== false ? h('button', {
                type: 'button',
                class: 'quiet-button',
                onClick: previous,
              }, 'Back') : null,
              h('button', {
                ref: primaryFocus,
                type: 'button',
                class: 'card-primary-button',
                onClick: next,
              }, currentStep?.nextLabel ?? (isLastStep ? (section.finishLabel ?? 'Done') : 'Next')),
            ]),
          ]) : null,
        ]),
      ]);
    };
  },
};
