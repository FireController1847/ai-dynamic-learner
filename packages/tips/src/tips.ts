import { defineComponent, h, type PropType, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import type { TipSection, TipsFeature } from './types.ts';
import { useTips } from './use-tips.ts';
export interface TipsHandle { open(trigger?: EventTarget | null): void }

export const TipsExperience = defineComponent({
  name: 'TipsExperience',
  props: {
    feature: { type: Object as PropType<TipsFeature | null>, default: null },
  },
  setup(props, { expose }) {
    const menuDialog = ref<HTMLDialogElement | null>(null);
    const { primaryFocus, openState, mode, stepIndex, preferences, tutorial, sections, activeSection, step, card, targetRect, cardPlacement, cardStyle, dragging, scrims, beginCardDrag, dragCard, endCardDrag, hasSeenSection, availableNow, prepareAndStart, open, startSection, skipSection, showMenu, close, previous, next, toggleAutomaticTips, resetCurrentTips } = useTips(props);
    expose({ open });

    function progressDots(section: TipSection) {
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

    async function syncMenuDialog() {
      await nextTick();
      const dialog = menuDialog.value;
      if (!dialog) return;
      if (openState.value && mode.value === 'menu') {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    }

    function closeMenu(event?: Event) {
      event?.preventDefault();
      close();
    }

    function menuContent() {
      let firstAvailableAssigned = false;
      return [
        h('section', {
          class: 'tips-menu-card',
          onClick: (event: MouseEvent) => event.stopPropagation(),
        }, [
          h('header', { class: 'tips-menu-header' }, [
            h('h2', { id: 'tips-menu-heading' }, `${props.feature?.label ?? 'Page'} tips`),
            h('button', {
              type: 'button',
              class: 'tips-menu-close',
              onClick: close,
            }, 'Close'),
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
              class: 'tips-danger-button tips-reset-button',
              onClick: resetCurrentTips,
            }, 'Reset tips'),
          ]),
        ]),
      ];
    }

    function tourContent() {
      const section = activeSection.value;
      const currentStep = step.value;
      if (!section || !currentStep) return [];
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
            class: 'tips-button',
            onClick: showMenu,
          }, 'All guides'),
          h('button', {
            type: 'button',
            class: 'tips-button',
            onClick: toggleAutomaticTips,
          }, preferences.value.enabled ? 'Stop automatic tips' : 'Show tips automatically'),
        ]),
      ]);
    }

    watch([openState, mode], syncMenuDialog, { immediate: true });
    onMounted(syncMenuDialog);
    onDeactivated(() => {
      if (menuDialog.value?.open) menuDialog.value.close();
    });
    onBeforeUnmount(() => {
      if (menuDialog.value?.open) menuDialog.value.close();
    });

    return () => {
      if (!openState.value || !tutorial.value || !props.feature) return null;
      if (mode.value === 'menu') return h('dialog', {
        ref: menuDialog,
        class: 'tips-menu-dialog',
        'aria-labelledby': 'tips-menu-heading',
        onCancel: closeMenu,
        onClick: (event: MouseEvent) => {
          if (event.target === menuDialog.value) close();
        },
      }, menuContent());
      const section = activeSection.value;
      const currentStep = step.value;
      const isLastStep = section && stepIndex.value === section.steps.length - 1;
      const spotlight = targetRect.value;

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
          onClick: skipSection,
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
            'is-centered': cardPlacement.value === 'center',
            'is-dragging': dragging.value,
          }],
          role: 'dialog',
          'aria-labelledby': 'tips-heading',
          'data-placement': cardPlacement.value,
          style: cardStyle.value,
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
              class: 'tips-button tips-skip',
              onClick: skipSection,
            }, 'Skip'),
          ]),
          ...tourContent(),
          h('footer', { class: 'tips-footer' }, [
            moreMenu(),
            h('div', { class: 'tips-navigation' }, [
              stepIndex.value > 0 && currentStep?.back !== false ? h('button', {
                type: 'button',
                class: 'tips-button',
                onClick: previous,
              }, 'Back') : null,
              h('button', {
                ref: primaryFocus,
                type: 'button',
                class: 'tips-primary-button',
                onClick: next,
              }, currentStep?.nextLabel ?? (isLastStep ? (section.finishLabel ?? 'Done') : 'Next')),
            ]),
          ]),
        ]),
      ]);
    };
  },
});
