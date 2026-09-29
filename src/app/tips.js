import { Icon } from '../components/icon.js';
import { tipsCatalog } from './tips-content.js';

const { computed, h, nextTick, ref, watch } = window.Vue;

const STORAGE_KEY = 'dynamic-learner.tips.v1';

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

export const TipsExperience = {
  name: 'TipsExperience',
  props: {
    feature: { type: Object, default: null },
  },
  setup(props, { expose }) {
    const dialog = ref(null);
    const openState = ref(false);
    const stepIndex = ref(0);
    const preferences = ref(readPreferences());
    let returnFocus = null;

    const tutorial = computed(() => tipsCatalog[props.feature?.id] ?? null);
    const step = computed(() => tutorial.value?.steps[stepIndex.value] ?? null);

    function hasSeenCurrentTutorial() {
      return Boolean(props.feature?.id && tutorial.value &&
        preferences.value.seen[props.feature.id] === tutorial.value.version);
    }

    function savePreferences(nextPreferences) {
      preferences.value = nextPreferences;
      writePreferences(nextPreferences);
    }

    function markCurrentTutorialSeen() {
      if (!props.feature?.id || !tutorial.value) return;
      savePreferences({
        ...preferences.value,
        seen: {
          ...preferences.value.seen,
          [props.feature.id]: tutorial.value.version,
        },
      });
    }

    function open(trigger = null) {
      if (!tutorial.value) return;
      returnFocus = trigger;
      stepIndex.value = 0;
      openState.value = true;
    }

    function skip() {
      markCurrentTutorialSeen();
      openState.value = false;
    }

    function finish() {
      markCurrentTutorialSeen();
      openState.value = false;
    }

    function previous() {
      stepIndex.value = Math.max(0, stepIndex.value - 1);
    }

    function next() {
      if (!tutorial.value) return;
      if (stepIndex.value >= tutorial.value.steps.length - 1) finish();
      else stepIndex.value += 1;
    }

    function toggleAutomaticTips() {
      savePreferences({
        ...preferences.value,
        enabled: !preferences.value.enabled,
      });
    }

    watch(openState, async (isOpen) => {
      await nextTick();
      if (isOpen) {
        if (dialog.value && !dialog.value.open) dialog.value.showModal();
      } else {
        if (dialog.value?.open) dialog.value.close();
        const target = returnFocus;
        returnFocus = null;
        if (target?.isConnected) target.focus();
      }
    });

    watch(() => props.feature?.id, async () => {
      openState.value = false;
      stepIndex.value = 0;
      returnFocus = null;
      await nextTick();
      if (tutorial.value && preferences.value.enabled && !hasSeenCurrentTutorial()) {
        openState.value = true;
      }
    }, { immediate: true });

    expose({ open });

    return () => {
      const guide = tutorial.value;
      const currentStep = step.value;
      if (!guide || !currentStep || !props.feature) return null;

      const isLastStep = stepIndex.value === guide.steps.length - 1;

      return h('dialog', {
        ref: dialog,
        class: 'tips-dialog',
        'aria-labelledby': 'tips-heading',
        onCancel: (event) => {
          event.preventDefault();
          skip();
        },
        onClick: (event) => {
          if (event.target === event.currentTarget) skip();
        },
      }, [
        h('div', { class: 'tips-card' }, [
          h('header', { class: 'tips-header' }, [
            h('div', { class: 'tips-heading-group' }, [
              h('span', { class: 'tips-badge' }, 'TIPS'),
              h('span', { class: 'tips-app-name' }, props.feature.label),
            ]),
            h('button', {
              type: 'button',
              class: 'quiet-button tips-skip',
              onClick: skip,
            }, 'Skip'),
          ]),
          h('div', { class: 'tips-body' }, [
            h('div', { class: 'tips-illustration', 'aria-hidden': 'true' }, [
              h(Icon, { name: 'lightbulb' }),
            ]),
            h('p', { class: 'tips-step-count' }, `Tip ${stepIndex.value + 1} of ${guide.steps.length}`),
            h('h2', { id: 'tips-heading' }, currentStep.title),
            h('p', { class: 'tips-copy' }, currentStep.body),
            h('div', {
              class: 'tips-progress',
              role: 'progressbar',
              'aria-label': 'Tutorial progress',
              'aria-valuemin': 1,
              'aria-valuemax': guide.steps.length,
              'aria-valuenow': stepIndex.value + 1,
            }, guide.steps.map((_, index) => h('span', {
              key: index,
              class: ['tips-progress-dot', { active: index === stepIndex.value, complete: index < stepIndex.value }],
            }))),
          ]),
          h('footer', { class: 'tips-footer' }, [
            h('div', { class: 'tips-preference' }, [
              h('button', {
                type: 'button',
                class: 'quiet-button',
                onClick: toggleAutomaticTips,
              }, preferences.value.enabled ? 'Disable automatic tips' : 'Enable automatic tips'),
              h('span', { class: 'tips-preference-status' },
                preferences.value.enabled ? 'Tips appear once for each app.' : 'Automatic tips are off.'),
            ]),
            h('div', { class: 'tips-navigation' }, [
              h('button', {
                type: 'button',
                class: 'quiet-button',
                disabled: stepIndex.value === 0,
                onClick: previous,
              }, 'Back'),
              h('button', {
                type: 'button',
                class: 'card-primary-button',
                onClick: next,
              }, isLastStep ? 'Done' : 'Next'),
            ]),
          ]),
        ]),
      ]);
    };
  },
};
