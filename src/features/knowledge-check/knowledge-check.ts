import type { KnowledgeCheck as FeatureModel, CheckTarget, LibraryItem } from './library-model.ts';
import type { KnowledgeCheckLibraryHandle } from './library.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { KnowledgeCheckLibrary } from './library.ts';
import { CheckBuilder } from './check-builder.ts';
import { createQuestion, type Question } from './question-model.ts';
import { KnowledgeSet } from './knowledge-set.ts';
import { canMove, deleteItem, findItem, firstEntry, groupOptions, moveItem, insertCheck } from './library-model.ts';

import { addTutorialActionListener, type TutorialCleanup, type TutorialRequest } from '../../../packages/tips/src/index.ts';

import {
  defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onMounted, ref,
} from 'vue';

type SetupTarget = CheckTarget;

const MIN_LIBRARY_WIDTH = 248;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.knowledge-check.library-width';

export const KnowledgeCheck = defineComponent({
  name: 'KnowledgeCheck',
  props: {
    title: { type: String, required: true },
    model: { type: Object as PropType<FeatureModel>, required: true },
  },
  setup(props) {
    const setupTarget = ref<SetupTarget | null>(null);
    const selectedId = useLibrarySelection({
      firstId: () => firstEntry(props.model.items)?.id ?? null,
      hasItem: (id) => findItem(props.model.items, id) !== null,
      enabled: () => setupTarget.value === null,
      onAutoSelect: (id) => {
        library.value?.reveal(id);
      },
    });
    const setupVersion = ref(0);
    const workspaceHeading = ref<HTMLElement | null>(null);
    const overlayQuery = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const libraryOverlay = ref(overlayQuery.matches);
    const libraryCollapsed = ref(overlayQuery.matches && selectedId.value !== null);
    const layout = ref<HTMLElement | null>(null);
    const library = ref<KnowledgeCheckLibraryHandle | null>(null);
    const showLibraryButton = ref<HTMLButtonElement | null>(null);
    const message = ref('');
    let removeTipsActionListener: (() => void) | null = null;

    function createTutorialQuestions(): Question[] {
      const multipleChoice = createQuestion('multiple-choice');
      multipleChoice.prompt = 'Which planet do we live on?';
      multipleChoice.choices = ['Earth', 'Mars', 'Venus', 'Jupiter'];
      multipleChoice.answer = 'Earth';
      multipleChoice.explanation = 'We live on Earth.';

      const trueFalse = createQuestion('true-false');
      trueFalse.prompt = 'The Sun is a star.';
      trueFalse.answer = 'True';
      trueFalse.explanation = 'The Sun is a star at the center of our solar system.';

      const shortAnswer = createQuestion('short-answer');
      shortAnswer.prompt = 'How many days are in a week?';
      shortAnswer.answer = '7';
      shortAnswer.explanation = 'There are seven days in a week.';

      return [multipleChoice, trueFalse, shortAnswer];
    }

    async function prepareTipsAction(action: string): Promise<TutorialCleanup> {
      const supported = ['builder', 'mode', 'study', 'quiz', 'test'];
      if (!supported.includes(action)) throw new Error('Unknown Knowledge Check tutorial action.');

      const previousSelectedId = selectedId.value;
      const previousSetupTarget = setupTarget.value;
      const item = insertCheck(
        props.model.items,
        { parentId: null, parentName: 'Top level' },
        'Lorem ipsum',
        createTutorialQuestions(),
      );

      if (action !== 'mode') {
        item.mode = action === 'builder' ? 'study' : action as 'study' | 'quiz' | 'test';
      }

      setupTarget.value = null;
      selectedId.value = item.id;
      library.value?.reveal(item.id);
      if (libraryOverlay.value) libraryCollapsed.value = true;
      message.value = '';

      await nextTick();

      return () => {
        deleteItem(props.model.items, item.id);
        setupTarget.value = previousSetupTarget;
        const restoredId = previousSelectedId && findItem(props.model.items, previousSelectedId)
          ? previousSelectedId
          : firstEntry(props.model.items)?.id ?? null;
        selectedId.value = restoredId;
        if (restoredId) library.value?.reveal(restoredId);
        message.value = '';
      };
    }

    function handleTipsAction(event: CustomEvent<TutorialRequest>) {
      const detail = event.detail;
      if (detail?.featureId !== 'knowledge-check') return;
      detail.handled = true;
      prepareTipsAction(detail.action).then(detail.resolve, detail.reject);
    }

    const {
      width: libraryWidth,
      resizing: libraryResizing,
      maxWidth: maxLibraryWidth,
      currentWidth: currentLibraryWidth,
      resetWidth: resetLibraryWidth,
      beginResize: beginLibraryResize,
      resizeFromPointer: resizeLibraryFromPointer,
      endResize: endLibraryResize,
      resizeFromKeyboard: resizeLibraryFromKeyboard,
    } = usePersistedPanelResize({
      preferenceKey: LIBRARY_WIDTH_KEY,
      container: layout,
      panelSelector: '.knowledge-check-library',
      minWidth: MIN_LIBRARY_WIDTH,
      maxWidth: 640,
      minRemainingWidth: 320,
      fallbackWidth: 280,
      disabled: () => libraryOverlay.value || libraryCollapsed.value,
    });

    const selection = computed(() => findItem(props.model.items, selectedId.value));

    function updateLibraryLayout(event: MediaQueryListEvent) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) libraryCollapsed.value = true;
    }

    overlayQuery.addEventListener('change', updateLibraryLayout);
    onMounted(() => {
      removeTipsActionListener = addTutorialActionListener(handleTipsAction);
    });
    onBeforeUnmount(() => {
      removeTipsActionListener?.();
      removeTipsActionListener = null;
      overlayQuery.removeEventListener('change', updateLibraryLayout);
    });

    async function setLibraryCollapsed(collapsed: boolean) {
      libraryCollapsed.value = collapsed;
      await nextTick();
      if (collapsed) showLibraryButton.value?.focus();
      else library.value?.focusToggle();
    }

    function selectItem(id: string | null) {
      selectedId.value = id;
      setupTarget.value = null;
      message.value = '';
    }

    function openNewKnowledgeCheck(target: SetupTarget) {
      setupTarget.value = target;
      setupVersion.value += 1;
      message.value = '';
      if (libraryOverlay.value) libraryCollapsed.value = true;
    }

    async function cancelSetup() {
      setupTarget.value = null;
      await nextTick();
      if (workspaceHeading.value) workspaceHeading.value.focus();
      else if (libraryCollapsed.value) showLibraryButton.value?.focus();
      else library.value?.focusNewKnowledgeCheck();
    }

    function completeSetup(name: string, questions: Question[]) {
      if (!setupTarget.value) return;
      try {
        const item = insertCheck(props.model.items, setupTarget.value, name, questions);
        selectedId.value = item.id;
        setupTarget.value = null;
        library.value?.reveal(item.id);
        message.value = `Created ${item.name}.`;
        nextTick(() => workspaceHeading.value?.focus());
      } catch (error) {
        message.value = error instanceof Error ? error.message : String(error);
      }
    }

    function moveToGroup(event: Event) {
      if (!selectedId.value || !selection.value) return;
      const targetId = inputValue(event) || null;
      if (moveItem(props.model.items, selectedId.value, targetId, 'inside')) {
        library.value?.reveal(selectedId.value);
        message.value = `Moved ${selection.value.item.name}.`;
      }
    }

    function reorder(offset: number) {
      if (!selection.value) return;
      const { siblings, index, item } = selection.value;
      const neighbor = siblings[index + offset];
      if (neighbor && moveItem(
        props.model.items,
        item.id,
        neighbor.id,
        offset < 0 ? 'before' : 'after',
      )) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    function organizationControls(item: LibraryItem) {
      if (!selection.value) return null;
      return h('details', {
        key: `organization-${item.id}`,
        class: ['knowledge-check-organization', { 'library-group-organization': item.kind === 'group' }],
        open: item.kind === 'group',
      }, [
        h('summary', { class: 'organization-summary' }, 'Location and order'),
        h('div', { class: 'knowledge-check-location' }, [
          h('label', { for: 'knowledge-check-parent' }, 'Move to group'),
          h('select', {
            id: 'knowledge-check-parent',
            value: selection.value.parentId ?? '',
            onChange: moveToGroup,
          }, [
            h('option', { value: '' }, 'Top level'),
            ...groupOptions(props.model.items, selectedId.value).map((group) => h('option', {
              key: group.id,
              value: group.id,
              disabled: !canMove(props.model.items, item.id, group.id, 'inside'),
            }, group.label)),
          ]),
        ]),
        h('div', { class: 'knowledge-check-order-actions' }, [
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: selection.value.index === 0,
            onClick: () => reorder(-1),
          }, 'Move up'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: selection.value.index === selection.value.siblings.length - 1,
            onClick: () => reorder(1),
          }, 'Move down'),
        ]),
      ]);
    }

    function detail() {
      if (setupTarget.value) {
        return h('section', {
          class: 'knowledge-check-detail',
          'aria-label': 'Knowledge Check setup',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(CheckBuilder, {
            key: setupVersion.value,
            destination: setupTarget.value.parentName,
            onSave: completeSetup,
            onCancel: cancelSetup,
          }),
          message.value ? h('p', { class: 'knowledge-check-placeholder', role: 'status' }, message.value) : null,
        ]);
      }

      const item = selection.value?.item;
      if (!item || item.kind === 'group') {
        return h('section', {
          class: 'knowledge-check-detail',
          'aria-label': item ? 'Selected group' : 'Knowledge Check workspace',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(LibraryEmptyState, {
            class: { 'has-organization': item !== undefined },
            icon: 'checklist',
            title: item?.name ?? 'Build your question library',
            description: item ? 'Create a question set in this group, or select one from the Library.' : 'Make question sets and keep them organized.',
            actionLabel: 'New question set',
            onCreate: () => openNewKnowledgeCheck({ parentId: item?.id ?? null, parentName: item?.name ?? 'Top level' }),
          }),
          item ? organizationControls(item) : null,
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        ]);
      }

      return h('section', {
        class: 'knowledge-check-detail is-check',
        inert: libraryOverlay.value && !libraryCollapsed.value,
        'aria-label': 'Selected question set',
      }, [
        h('header', { class: 'knowledge-check-item-heading' }, [
          h('h2', { ref: workspaceHeading, tabindex: -1 }, item.name),
          h('p', 'Question set'),
        ]),
        h(KnowledgeSet, { key: item.id, item }),
        organizationControls(item),
        h('p', { class: 'visually-hidden', role: 'status' }, message.value),
      ]);
    }

    return () => h('section', {
      class: 'knowledge-check-page',
      'aria-label': props.title,
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === 'Escape' && libraryOverlay.value && !libraryCollapsed.value &&
            !(event.target instanceof Element && event.target.closest('dialog'))) {
          event.preventDefault();
          setLibraryCollapsed(true);
        }
      },
    }, [
      h('div', {
        ref: layout,
        class: ['knowledge-check-layout', {
          'library-collapsed': libraryCollapsed.value,
          'library-resizing': libraryResizing.value,
        }],
        style: libraryWidth.value === null ? null : {
          '--knowledge-check-library-width': `${libraryWidth.value}px`,
        },
      }, [
        libraryCollapsed.value ? h('button', {
          ref: showLibraryButton,
          type: 'button',
          class: 'icon-button knowledge-check-library-floating-toggle',
          title: 'Show library',
          'aria-label': 'Show library',
          'aria-expanded': false,
          'aria-controls': 'knowledge-check-library',
          onClick: () => setLibraryCollapsed(false),
        }, [h(Icon, { name: 'panel-open' })]) : null,
        libraryOverlay.value && !libraryCollapsed.value ? h('button', {
          type: 'button',
          class: 'knowledge-check-library-scrim',
          'aria-label': 'Close library',
          onClick: () => setLibraryCollapsed(true),
        }) : null,
        h(KnowledgeCheckLibrary, {
          ref: library,
          items: props.model.items,
          selectedId: selectedId.value,
          collapsed: libraryCollapsed.value,
          onToggleLibrary: () => setLibraryCollapsed(true),
          onSelect: selectItem,
          onOpenItem: () => { if (libraryOverlay.value) setLibraryCollapsed(true); },
          onNewCheck: openNewKnowledgeCheck,
        }),
        !libraryOverlay.value && !libraryCollapsed.value ? h('div', {
          class: 'knowledge-check-library-resizer',
          role: 'separator',
          tabindex: 0,
          'aria-label': 'Resize library',
          'aria-orientation': 'vertical',
          'aria-valuemin': MIN_LIBRARY_WIDTH,
          'aria-valuemax': maxLibraryWidth(),
          'aria-valuenow': Math.round(currentLibraryWidth()),
          onPointerdown: beginLibraryResize,
          onPointermove: resizeLibraryFromPointer,
          onPointerup: endLibraryResize,
          onPointercancel: endLibraryResize,
          onKeydown: resizeLibraryFromKeyboard,
          onDblclick: resetLibraryWidth,
        }) : null,
        detail(),
      ]),
    ]);
  },
});
