import { defineComponent, h, nextTick, onBeforeUnmount, onDeactivated, ref, shallowRef, watch, Transition, type PropType } from 'vue';
import { Icon } from '../../../components/icon.ts';
import { inputValue } from '../../../core/dom.ts';
import { newVariantSeed } from '../../../core/parameterized/random.ts';
import type { CheckItem } from '../library-model.ts';
import { preparePublicationJob, type PublicationJob } from './publication-job.ts';
import { bubblePublicationExclusions } from './prepare-publication.ts';
import { PUBLICATION_FONTS, PUBLICATION_LAYOUTS, defaultPublicationMetadata, publicationPaperDimensions, type PublicationSettings } from './publication-model.ts';
import { PublicationSettingsDialog } from './publication-settings-dialog.ts';
import { PublicationDropdown, type PublicationOption } from './publication-dropdown.ts';
import { reviewChoiceScreen } from '../choice-screen.ts';
import { leaveReviewPanel, restoreReviewPanel } from '../review-motion.ts';
import type { PaginatedPublication } from './paged-runtime.ts';
import type { PublicationZoom } from './publication-viewport.ts';

const ZOOM_OPTIONS: readonly { value: PublicationZoom; label: string }[] = [
  { value: 'page', label: 'Fit page' }, { value: 'fit', label: 'Fit width' },
  { value: 0.25, label: '25%' }, { value: 0.5, label: '50%' }, { value: 0.75, label: '75%' },
  { value: 1, label: '100%' }, { value: 1.25, label: '125%' }, { value: 1.5, label: '150%' }, { value: 2, label: '200%' },
];

export const PublicationSetup = defineComponent({
  name: 'ReviewPublicationSetup',
  props: { item: { type: Object as PropType<CheckItem>, required: true } },
  emits: { close: () => true, previewNavigation: (_back: (() => void) | null) => true },
  setup(props, { emit }) {
    const settings = ref<PublicationSettings>({
      layout: 'study', paper: 'letter', orientation: 'portrait', margin: 'standard',
      titleLayout: 'comfortable', columns: 1, alignColumns: false,
      questionMetadata: defaultPublicationMetadata(), keyMetadata: defaultPublicationMetadata(true), questionStyle: 'regular', content: 'questions', font: 'times', fontSize: 12, seed: newVariantSeed(),
    });
    const screen = ref<'selection' | 'warning' | 'document'>('selection');
    let acceptedExclusions = '';
    const documentFocus = ref<HTMLElement | null>(null);
    const prepared = shallowRef<PublicationJob | null>(null);
    const preview = shallowRef<PaginatedPublication | null>(null);
    const previewHost = ref<HTMLElement | null>(null);
    const zoom = ref<PublicationZoom>('fit');
    const showVersion = ref(false);
    const showSettings = ref(false);
    const versionButton = ref<HTMLButtonElement | null>(null);
    const busy = ref(false);
    const dirty = ref(true);
    const message = ref('');
    let pending: AbortController | null = null;
    let regenerateTimer: number | null = null;

    function cancelPending() {
      if (regenerateTimer !== null) window.clearTimeout(regenerateTimer);
      regenerateTimer = null;
      pending?.abort(); pending = null;
      busy.value = false;
    }
    function invalidate() {
      cancelPending();
      preview.value?.dispose(); preview.value = null;
      prepared.value = null; dirty.value = true; message.value = '';
    }
    function schedulePreview() {
      cancelPending(); dirty.value = true; message.value = '';
      if (screen.value !== 'document') return;
      if (settings.value.layout === 'bubble' && exclusionSignature() !== acceptedExclusions) {
        screen.value = 'warning'; return;
      }
      busy.value = true;
      regenerateTimer = window.setTimeout(() => { regenerateTimer = null; void prepare(); }, 300);
    }
    watch(() => [props.item.id, props.item.name, props.item.questions, props.item.options?.description, settings.value],
      schedulePreview, { deep: true, flush: 'sync' });
    watch(zoom, value => preview.value?.setZoom(value));
    function backToSelection() {
      cancelPending(); showVersion.value = false; showSettings.value = false; screen.value = 'selection';
    }
    watch(screen, value => emit('previewNavigation', value === 'document' ? backToSelection : null), { flush: 'sync' });
    onBeforeUnmount(() => { invalidate(); emit('previewNavigation', null); });
    onDeactivated(() => { invalidate(); showSettings.value = false; screen.value = 'selection'; });

    async function prepare() {
      cancelPending(); dirty.value = true; message.value = '';
      const controller = new AbortController();
      pending = controller; busy.value = true;
      try {
        const job = await preparePublicationJob(props.item, settings.value, controller.signal);
        const renderer = settings.value.layout === 'bubble'
          ? (await import('./bubble-renderer.ts')).bubbleRenderer
          : (await import('./study-renderer.ts')).studyRenderer;
        controller.signal.throwIfAborted();
        await nextTick();
        if (!previewHost.value) throw new Error('The preview could not be opened.');
        const pages = await job.paginate(previewHost.value, renderer, controller.signal);
        if (controller.signal.aborted) pages.dispose();
        else {
          const previous = preview.value;
          const scrollX = previous?.frame.contentWindow?.scrollX ?? 0;
          const scrollY = previous?.frame.contentWindow?.scrollY ?? 0;
          pages.setZoom(zoom.value);
          pages.frame.contentWindow?.scrollTo(scrollX, scrollY);
          await pages.reveal();
          if (controller.signal.aborted) { pages.dispose(); return; }
          prepared.value = job; preview.value = pages; dirty.value = false;
          previous?.dispose();
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const detail = error instanceof Error ? error.message : String(error);
          message.value = detail + (preview.value ? ' Showing the previous preview.' : '');
        }
      } finally {
        if (pending === controller) { pending = null; busy.value = false; }
      }
    }

    function print() {
      if (!preview.value || busy.value || dirty.value) return;
      try {
        const target = preview.value.frame.contentWindow;
        if (!target) throw new Error('Refresh the preview before printing.');
        target.focus(); target.print();
      } catch (error) { message.value = error instanceof Error ? error.message : String(error); }
    }

    function choice<K extends 'paper' | 'orientation' | 'margin' | 'titleLayout' | 'font' | 'questionStyle' | 'content'>(
      key: K, label: string, icon: string, options: readonly (PublicationOption & { id: PublicationSettings[K] })[],
    ) {
      return h(PublicationDropdown, { label, icon, value: settings.value[key], options, onSelect: (id: string) => {
          const selected = options.find(option => option.id === id);
          if (selected) settings.value[key] = selected.id;
      } });
    }

    function exclusionSignature() {
      return JSON.stringify(bubblePublicationExclusions(props.item.questions).map(exclusion =>
        ({ ...exclusion, id: props.item.questions[exclusion.number - 1]?.id })));
    }

    function openDocument() {
      acceptedExclusions = exclusionSignature();
      screen.value = 'document';
    }

    function selectionHeader(title: string, back: () => void) {
      return h('header', { class: 'knowledge-builder-header review-publication-header' }, [
        h('div', { class: 'knowledge-check-builder-intro' }, [
          h('h2', { ref: documentFocus, 'data-review-focus': '', tabindex: -1 }, title),
          h('p', { class: 'knowledge-muted' }, props.item.name),
        ]),
        h('button', { type: 'button', class: 'quiet-button', onClick: back }, 'Back'),
      ]);
    }

    function bubbleWarning() {
      const exclusions = bubblePublicationExclusions(props.item.questions);
      const included = props.item.questions.length - exclusions.length;
      const groups = new Map<string, number[]>();
      for (const { number, reason } of exclusions) groups.set(reason, [...(groups.get(reason) ?? []), number]);
      return h('div', { key: 'warning', class: 'knowledge-check-builder' }, [
        selectionHeader('Some questions cannot use bubbles', backToSelection),
        h('div', { class: 'review-publication-warning' }, [
          h('p', `${exclusions.length} ${exclusions.length === 1 ? 'question will' : 'questions will'} be left out of the question sheet, bubble sheet, and answer key.`),
          h('ul', [...groups].map(([reason, numbers]) => h('li', [
            h('strong', reason), h('p', `Questions: ${numbers.join(', ')}`),
          ]))),
          h('p', included ? 'Included questions keep their original numbers. Study supports all question types.' :
            'No supported questions remain. Use Study to publish this set, or go back and choose another layout.'),
        ]),
        h('div', { class: 'knowledge-actions review-publication-warning-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => {
            settings.value.layout = 'study'; openDocument();
          } }, 'Use Study'),
          h('button', { type: 'button', class: 'card-primary-button', disabled: !included, onClick: openDocument },
            `Continue with ${included} supported ${included === 1 ? 'item' : 'items'}`),
        ]),
      ]);
    }

    function modePicker() {
      return reviewChoiceScreen({
        key: 'selection', eyebrow: 'Publish', title: 'Choose a sheet layout',
        description: 'Create printable question sheets with an optional answer key.',
        choices: PUBLICATION_LAYOUTS.map(mode => ({
          id: mode.id, label: mode.label, description: mode.description, icon: mode.icon,
          disabled: !mode.available,
          detail: !mode.available ? h('span', { class: 'knowledge-choice-note' }, 'Coming soon') : null,
        })),
        onChoose: id => {
          settings.value.layout = id;
          if (id === 'bubble' && bubblePublicationExclusions(props.item.questions).length) screen.value = 'warning';
          else openDocument();
        },
        onBack: () => emit('close'),
      });
    }

    function documentWorkspace() {
      const paper = publicationPaperDimensions(settings.value);
      return h('div', { key: 'document', ref: documentFocus, class: 'review-publication-study',
        role: 'region', 'aria-label': `${settings.value.layout === 'bubble' ? 'Bubble' : 'Study'} sheet publishing settings`,
        tabindex: -1, 'data-review-focus': '' }, [
        h('div', { class: 'review-publication-toolbar-scroll', role: 'region',
          'aria-label': 'Document settings, scroll horizontally for more options', tabindex: 0 }, [
          h('div', { class: 'review-publication-toolbar', role: 'group', 'aria-label': 'Document settings' }, [
          h('div', { class: 'publication-toolbar-group', role: 'group', 'aria-label': 'Included pages' }, [
            choice('content', 'Content', 'document', [
              { id: 'questions', label: 'Questions Only', description: 'Print the question sheet without answers.' },
              { id: 'both', label: 'Questions and Answer Key', description: 'Append a separate answer key after the questions.' },
              { id: 'key', label: 'Answer Key Only', description: 'Print the answer key without question pages.' },
            ]),
          ]),
          h('div', { class: 'publication-toolbar-group', role: 'group', 'aria-label': 'Typography' }, [
            choice('font', 'Font', 'text-font', PUBLICATION_FONTS.map(font => ({ id: font.id, label: font.label, fontFamily: font.css }))),
            h('label', { class: 'publication-font-size', title: 'Font size' }, [h(Icon, { name: 'text-size' }),
              h('input', { type: 'number', inputmode: 'decimal', min: 8, max: 32, step: 0.5, value: settings.value.fontSize,
                'aria-label': 'Font size in points', onChange: (event: Event) => {
                  const size = Number(inputValue(event));
                  if (Number.isFinite(size) && size >= 8 && size <= 32 && Number.isInteger(size * 2)) settings.value.fontSize = size;
                  else if (event.target instanceof HTMLInputElement) event.target.value = String(settings.value.fontSize);
                } }), h('span', 'pt')]),
          ]),
          h('div', { class: 'publication-toolbar-group', role: 'group', 'aria-label': 'Page layout' }, [
            choice('paper', 'Paper', 'document', [{ id: 'letter', label: 'US Letter' }, { id: 'a4', label: 'A4' }]),
            choice('orientation', 'Orientation', 'page-portrait', [
              { id: 'portrait', label: 'Portrait', icon: 'page-portrait' }, { id: 'landscape', label: 'Landscape', icon: 'page-landscape' }]),
            choice('margin', 'Margins', 'page-margins', [
              { id: 'standard', label: 'Standard margins' }, { id: 'compact', label: 'Compact margins' }]),
            h(PublicationDropdown, {
              label: 'Columns', icon: 'page-layout', value: String(settings.value.columns),
              options: [{ id: '1', label: '1 column' }, { id: '2', label: '2 columns' }],
              onSelect: (id: string) => { if (id === '1' || id === '2') settings.value.columns = id === '1' ? 1 : 2; },
            }),
            choice('questionStyle', 'Question text', 'text-font', [
              { id: 'regular', label: 'Regular' },
              { id: 'bold', label: 'Bold' },
              { id: 'italic', label: 'Italic' },
              { id: 'bold-italic', label: 'Bold italic' },
              { id: 'underline', label: 'Underline' },
            ]),
            choice('titleLayout', 'Layout', 'page-layout', [{ id: 'cover', label: 'Cover page', description: 'Title and name on a separate page' },
              { id: 'comfortable', label: 'Comfortable', description: 'More space around the title and questions' },
              { id: 'compact', label: 'Compact', description: 'Closer spacing with the same font and size' }]),
          ]),
          ]),
        ]),
        h('div', { ref: previewHost, class: 'review-publication-preview', 'aria-label': 'Publication pages', 'aria-busy': busy.value }, [
          !preview.value ? h('div', { class: 'review-publication-placeholder' }, [
            h('div', { class: 'review-publication-empty-page', style: {
              aspectRatio: `${paper.width} / ${paper.height}`,
            } }, [!busy.value ? h('p', message.value ? 'Preview unavailable' : 'Choose Refresh to preview this sheet.') : null]),
          ]) : null,
          h(Transition, { name: 'publication-loading' }, { default: () => busy.value ? h('div', { class: 'review-publication-loading', 'aria-hidden': 'true' }, [
            h(Icon, { name: 'loading' }), h('span', preview.value ? 'Updating pages…' : 'Preparing pages…'),
          ]) : null }),
        ]),
        h('footer', { class: 'review-publication-toolbar-actions', 'aria-label': 'Document actions and preview status' }, [
            h('button', { type: 'button', class: 'quiet-button', 'aria-haspopup': 'dialog',
              onClick: () => { showSettings.value = true; } }, [h(Icon, { name: 'settings' }), 'Settings']),
            h('button', { ref: versionButton, type: 'button', class: 'quiet-button', 'aria-expanded': showVersion.value,
              'aria-controls': 'review-publication-version', onClick: () => { showVersion.value = !showVersion.value; } },
              [h(Icon, { name: 'tag' }), 'Version']),
            h('div', { class: 'review-publication-status' }, [
              h('span', { role: message.value ? 'alert' : 'status', 'aria-live': 'polite' }, message.value || (busy.value
                ? 'Updating preview…' : prepared.value ? `${prepared.value.view.questions.length} items · ${preview.value?.pageCount ?? 0} pages` : 'Preview not ready')),
              h('span', { class: 'knowledge-muted' }, 'Read-only'),
              busy.value ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
                cancelPending(); message.value = 'Preview update cancelled.' + (preview.value ? ' Showing the previous preview.' : '');
              } }, 'Cancel') : null,
            ]),
            zoomControls(),
            h('div', { class: 'review-publication-run-actions' }, [
              h('button', { type: 'button', class: 'quiet-button', disabled: busy.value, onClick: prepare,
                title: 'Refresh the preview' }, [h(Icon, { name: 'refresh-cw' }), 'Refresh']),
              h('button', { type: 'button', class: 'card-primary-button', disabled: !preview.value || busy.value || dirty.value,
                title: 'Print or save as PDF', onClick: print }, [h(Icon, { name: 'printer' }), 'Print']),
            ]),
        ]),
        h(Transition, { name: 'publication-panel', onBeforeLeave: leaveReviewPanel,
          onLeaveCancelled: restoreReviewPanel, onAfterEnter: restoreReviewPanel,
        }, { default: () => showVersion.value ? h('div', { class: 'publication-panel' }, [
          h('div', { class: 'publication-panel-inner' }, [h('div', { id: 'review-publication-version', class: 'review-publication-version' }, [
          h('label', { class: 'knowledge-field review-publication-field' }, [h('span', 'Version code'),
            h('input', { type: 'text', maxlength: 128, value: settings.value.seed,
              onInput: (event: Event) => { settings.value.seed = inputValue(event); } })]),
          h('p', 'Keep this code to reuse generated questions and choices. Preview updates run any uploaded question algorithms.'),
          h('button', { type: 'button', class: 'quiet-button', onClick: async () => {
            showVersion.value = false; await nextTick(); versionButton.value?.focus();
          } }, 'Done'),
        ])]),
        ]) : null }),
      ]);
    }

    function stepZoom(direction: -1 | 1) {
      const current = typeof zoom.value === 'number' ? zoom.value : preview.value?.getZoom() ?? 0.5;
      const levels = ZOOM_OPTIONS.flatMap(option => typeof option.value === 'number' ? [option.value] : []);
      const next = direction === 1 ? levels.find(value => value > current + 0.001)
        : levels.reverse().find(value => value < current - 0.001);
      if (next !== undefined) zoom.value = next;
    }

    function zoomControls() {
      return h('div', { class: 'review-publication-zoom', role: 'group', 'aria-label': 'Preview zoom' }, [
        h('button', { type: 'button', class: 'icon-button', 'aria-label': 'Zoom out', title: 'Zoom out',
          onClick: () => stepZoom(-1) }, [h(Icon, { name: 'minus' })]),
        h('select', { 'aria-label': 'Zoom', value: String(zoom.value), onChange: (event: Event) => {
          const selected = ZOOM_OPTIONS.find(option => String(option.value) === inputValue(event));
          if (selected) zoom.value = selected.value;
        } }, ZOOM_OPTIONS.map(option => h('option', { value: String(option.value) }, option.label))),
        h('button', { type: 'button', class: 'icon-button', 'aria-label': 'Zoom in', title: 'Zoom in',
          onClick: () => stepZoom(1) }, [h(Icon, { name: 'plus' })]),
      ]);
    }

    return () => h('section', { class: 'review-publication', 'aria-label': 'Publish knowledge set' }, [
      h(Transition, { name: 'knowledge-view', mode: 'out-in',
        onBeforeLeave: leaveReviewPanel, onLeaveCancelled: restoreReviewPanel,
        onAfterLeave: (element: Element) => { if (element.classList.contains('review-publication-study')) invalidate(); },
        onAfterEnter: (element: Element) => {
          restoreReviewPanel(element);
          const target = screen.value === 'selection'
            ? element.querySelector<HTMLButtonElement>(`[data-review-choice="${settings.value.layout}"]`) : documentFocus.value;
          target?.focus({ preventScroll: true });
          if (screen.value === 'document') schedulePreview();
        },
      }, { default: () => screen.value === 'document' ? documentWorkspace() :
        screen.value === 'warning' ? bubbleWarning() : modePicker() }),
      showSettings.value && screen.value === 'document' ? h(PublicationSettingsDialog, { settings: settings.value,
        onClose: () => { showSettings.value = false; }, onUpdate: (value: PublicationSettings) => { settings.value = value; } }) : null,
    ]);
  },
});
