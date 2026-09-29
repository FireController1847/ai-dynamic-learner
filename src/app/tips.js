import { Icon } from '../components/icon.js';
import { tipsCatalog } from './tips-content.js';

const { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } = window.Vue;

const STORAGE_KEY = 'dynamic-learner.tips.v1';
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

    let returnFocus = null;
    let currentTarget = null;
    let resizeObserver = null;
    let contextObserver = null;
    let updateFrame = 0;
    let autoFrame = 0;
    let returnToMenu = false;

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

    function open(trigger = null) {
      if (!tutorial.value) return;
      returnFocus = trigger;
      returnToMenu = false;
      mode.value = 'menu';
      activeSectionId.value = null;
      stepIndex.value = 0;
      targetRect.value = null;
      cardPlacement.value = 'center';
      cardStyle.value = centeredCardStyle();
      openState.value = true;
    }

    function startSection(section, fromMenu = false) {
      if (!section || !sectionAvailable(section)) return;
      returnToMenu = fromMenu;
      mode.value = 'tour';
      activeSectionId.value = section.id;
      stepIndex.value = 0;
      openState.value = true;
    }

    function finishSection() {
      markSectionSeen();
      if (returnToMenu) showMenu();
      else close();
    }

    function skipSection() {
      markSectionSeen();
      if (returnToMenu) showMenu();
      else close();
    }

    function showMenu() {
      returnToMenu = false;
      mode.value = 'menu';
      activeSectionId.value = null;
      stepIndex.value = 0;
      trackTarget(null);
      targetRect.value = null;
      cardPlacement.value = 'center';
      cardStyle.value = centeredCardStyle();
      nextTick(() => primaryFocus.value?.focus());
    }

    function close() {
      openState.value = false;
    }

    function previous() {
      stepIndex.value = Math.max(0, stepIndex.value - 1);
    }

    function next() {
      if (!activeSection.value) return;
      if (stepIndex.value >= activeSection.value.steps.length - 1) finishSection();
      else stepIndex.value += 1;
    }

    function toggleAutomaticTips() {
      savePreferences({
        ...preferences.value,
        enabled: !preferences.value.enabled,
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

    function positionCard(rect) {
      const element = card.value;
      if (!element || !rect) {
        cardPlacement.value = 'center';
        cardStyle.value = centeredCardStyle();
        return;
      }

      const bounds = element.getBoundingClientRect();
      const cardWidth = bounds.width;
      const cardHeight = bounds.height;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const centerX = (rect.left + rect.right) / 2;
      const centerY = (rect.top + rect.bottom) / 2;
      const preferred = step.value?.placement;
      const placements = [preferred, 'right', 'left', 'bottom', 'top']
        .filter((value, index, values) => value && values.indexOf(value) === index);

      const fits = {
        right: viewportWidth - rect.right - CARD_GAP - VIEWPORT_MARGIN >= cardWidth,
        left: rect.left - CARD_GAP - VIEWPORT_MARGIN >= cardWidth,
        bottom: viewportHeight - rect.bottom - CARD_GAP - VIEWPORT_MARGIN >= cardHeight,
        top: rect.top - CARD_GAP - VIEWPORT_MARGIN >= cardHeight,
      };

      const placement = placements.find((candidate) => fits[candidate]) ?? 'center';
      cardPlacement.value = placement;

      if (placement === 'center') {
        cardStyle.value = centeredCardStyle();
        return;
      }

      let top;
      let left;
      if (placement === 'right' || placement === 'left') {
        top = clamp(centerY - cardHeight / 2, VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN);
        left = placement === 'right' ? rect.right + CARD_GAP : rect.left - CARD_GAP - cardWidth;
      } else {
        left = clamp(centerX - cardWidth / 2, VIEWPORT_MARGIN, viewportWidth - cardWidth - VIEWPORT_MARGIN);
        top = placement === 'bottom' ? rect.bottom + CARD_GAP : rect.top - CARD_GAP - cardHeight;
      }

      cardStyle.value = {
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        transform: 'none',
      };
    }

    function updatePosition() {
      if (!openState.value || mode.value !== 'tour') return;
      const element = visibleTarget(step.value?.target);
      trackTarget(element);

      if (!element) {
        targetRect.value = null;
        positionCard(null);
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
      await nextTick();
      updatePosition();
      focusPrimaryControl();
    });

    watch(activeSectionId, async () => {
      if (!openState.value || mode.value !== 'tour') return;
      await nextTick();
      updatePosition();
      focusPrimaryControl();
    });

    watch(() => props.feature?.id, async () => {
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
    onBeforeUnmount(removeGlobalTracking);

    expose({ open });

    function menuContent() {
      const guide = tutorial.value;
      if (!guide) return null;

      let firstAvailableAssigned = false;
      return [
        h('div', { class: 'tips-menu-intro' }, [
          h('div', { class: 'tips-illustration', 'aria-hidden': 'true' }, [
            h(Icon, { name: 'lightbulb' }),
          ]),
          h('p', { class: 'tips-step-count' }, 'Choose a guide'),
          h('h2', { id: 'tips-heading' }, `${props.feature.label} tips`),
          h('p', { id: 'tips-copy', class: 'tips-copy' },
            'Tips are split into sections so the guide can match the part of the app you are using right now.'),
        ]),
        h('div', { class: 'tips-section-list' }, sections.value.map((section) => {
          const available = availableNow(section);
          const seen = hasSeenSection(section);
          const assignFocus = available && !firstAvailableAssigned;
          if (assignFocus) firstAvailableAssigned = true;
          return h('button', {
            key: section.id,
            ref: assignFocus ? primaryFocus : undefined,
            type: 'button',
            class: 'tips-section-choice',
            disabled: !available,
            onClick: () => startSection(section, true),
          }, [
            h('span', { class: 'tips-section-choice-copy' }, [
              h('strong', section.title),
              h('span', section.description),
            ]),
            h('span', { class: ['tips-section-state', { complete: seen }] },
              !available ? 'Open this part of the app' : seen ? 'Seen · View again' : 'Available now'),
          ]);
        })),
      ];
    }

    function tourContent() {
      const section = activeSection.value;
      const currentStep = step.value;
      if (!section || !currentStep) return null;
      return [
        h('div', { class: 'tips-body' }, [
          h('div', { class: 'tips-illustration', 'aria-hidden': 'true' }, [
            h(Icon, { name: 'lightbulb' }),
          ]),
          h('p', { class: 'tips-step-count' },
            `${section.title} · Tip ${stepIndex.value + 1} of ${section.steps.length}`),
          h('h2', { id: 'tips-heading' }, currentStep.title),
          h('p', { id: 'tips-copy', class: 'tips-copy' }, currentStep.body),
          hasSpotlight.value && currentStep.targetLabel ? h('p', { class: 'tips-target-caption' },
            `Highlighted: ${currentStep.targetLabel}`) : null,
          h('div', {
            class: 'tips-progress',
            role: 'progressbar',
            'aria-label': 'Tutorial progress',
            'aria-valuemin': 1,
            'aria-valuemax': section.steps.length,
            'aria-valuenow': stepIndex.value + 1,
          }, section.steps.map((_, index) => h('span', {
            key: index,
            class: ['tips-progress-dot', { active: index === stepIndex.value, complete: index < stepIndex.value }],
          }))),
        ]),
      ];
    }

    return () => {
      if (!openState.value || !tutorial.value || !props.feature) return null;
      const isMenu = mode.value === 'menu';
      const section = activeSection.value;
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
          class: ['tips-card', { 'is-centered': isMenu || cardPlacement.value === 'center', 'is-menu': isMenu }],
          role: 'dialog',
          'aria-labelledby': 'tips-heading',
          'aria-describedby': 'tips-copy',
          'data-placement': isMenu ? 'center' : cardPlacement.value,
          style: isMenu ? centeredCardStyle() : cardStyle.value,
        }, [
          h('header', { class: 'tips-header' }, [
            h('div', { class: 'tips-heading-group' }, [
              h('span', { class: 'tips-badge' }, 'TIPS'),
              h('span', { class: 'tips-app-name' }, props.feature.label),
              !isMenu && section ? h('span', { class: 'tips-section-name' }, section.title) : null,
            ]),
            h('button', {
              type: 'button',
              class: 'quiet-button tips-skip',
              onClick: isMenu ? close : skipSection,
            }, isMenu ? 'Close' : 'Skip section'),
          ]),
          ...(isMenu ? menuContent() : tourContent()),
          h('footer', { class: 'tips-footer' }, [
            h('div', { class: 'tips-preference' }, [
              h('button', {
                type: 'button',
                class: 'quiet-button',
                onClick: toggleAutomaticTips,
              }, preferences.value.enabled ? 'Disable automatic tips' : 'Enable automatic tips'),
              h('span', { class: 'tips-preference-status' },
                preferences.value.enabled
                  ? 'Each section appears once when you first reach it.'
                  : 'Automatic tips are off. You can still open any available section here.'),
            ]),
            !isMenu ? h('div', { class: 'tips-navigation' }, [
              returnToMenu ? h('button', {
                type: 'button',
                class: 'quiet-button',
                onClick: showMenu,
              }, 'All guides') : null,
              h('button', {
                type: 'button',
                class: 'quiet-button',
                disabled: stepIndex.value === 0,
                onClick: previous,
              }, 'Back'),
              h('button', {
                ref: primaryFocus,
                type: 'button',
                class: 'card-primary-button',
                onClick: next,
              }, isLastStep ? 'Done' : 'Next'),
            ]) : null,
          ]),
        ]),
      ]);
    };
  },
};
