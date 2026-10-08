import { defineComponent, h, nextTick, onBeforeUnmount, ref, Transition, type PropType } from 'vue';
import { inputValue } from '../core/dom.ts';
import { Icon } from './icon.ts';

export interface AiPromptExchangeHandle { showImport(): void }

export const AiPromptExchange = defineComponent({
  name: 'AiPromptExchange',
  props: {
    idPrefix: { type: String, required: true },
    prompt: { type: String, required: true },
    promptHelp: { type: String, required: true },
    importHelp: { type: String, required: true },
    label: { type: String, required: true },
    json: { type: String, default: '' },
    problem: { type: String, default: '' },
    maxLength: { type: Number, default: undefined },
    validateLabel: { type: String, default: 'Validate JSON' },
    readyInstructions: { type: Array as PropType<string[]>, required: true },
    hasPreview: Boolean,
    startInImport: Boolean,
  },
  emits: { 'update-json': (_value: string) => true, validate: () => true },
  setup(props, { emit, slots, expose }) {
    const tab = ref<'prompt' | 'import'>(props.startInImport ? 'import' : 'prompt');
    const backward = ref(false);
    const shown = ref(false);
    const copied = ref(false);
    const status = ref('');
    const handoff = ref<'idle' | 'waiting' | 'ready'>(props.startInImport ? 'ready' : 'idle');
    const input = ref<HTMLTextAreaElement | null>(null);
    const preview = ref<HTMLElement | null>(null);
    const ready = ref<HTMLButtonElement | null>(null);
    const promptTab = ref<HTMLButtonElement | null>(null);
    const importTab = ref<HTMLButtonElement | null>(null);
    let timer: number | null = null;
    let disposed = false;
    let focusAfterEnter = false;
    function clearTimer() { if (timer !== null) window.clearTimeout(timer); timer = null; }
    onBeforeUnmount(() => { disposed = true; clearTimer(); });
    function select(value: 'prompt' | 'import', keyboard = false) {
      clearTimer();
      copied.value = false;
      backward.value = value === 'prompt';
      tab.value = value;
      if (keyboard) nextTick(() => (value === 'prompt' ? promptTab : importTab).value?.focus());
    }
    expose({ showImport() {
      handoff.value = 'ready';
      focusAfterEnter = true;
      if (tab.value === 'import') nextTick(() => (props.hasPreview ? preview.value : input.value)?.focus());
      else select('import');
    } });
    async function copy() {
      clearTimer();
      try {
        await navigator.clipboard.writeText(props.prompt);
        if (disposed) return;
        copied.value = true;
        status.value = 'Prompt copied.';
        handoff.value = 'waiting';
        timer = window.setTimeout(() => {
          timer = null;
          status.value = '';
          backward.value = false;
          focusAfterEnter = true;
          tab.value = 'import';
        }, 650);
      } catch {
        if (disposed) return;
        copied.value = false;
        shown.value = true;
        status.value = 'Copy failed. The prompt is shown below so you can copy it manually.';
      }
    }
    function afterEnter() {
      if (!focusAfterEnter || tab.value !== 'import') return;
      focusAfterEnter = false;
      copied.value = false;
      (handoff.value === 'waiting' ? ready.value : props.hasPreview ? preview.value : input.value)?.focus({ preventScroll: !props.hasPreview });
    }
    async function responseReady() {
      handoff.value = 'ready';
      await nextTick();
      input.value?.focus({ preventScroll: true });
      const panel = input.value?.closest<HTMLElement>('.ai-exchange-panel');
      const container = panel?.closest<HTMLElement>('[data-ai-scroll-region]');
      if (!panel || !container) return;
      const offset = panel.getBoundingClientRect().top - container.getBoundingClientRect().top - 24;
      container.scrollTo({
        top: Math.max(0, Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + offset)),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
    const button = (id: 'prompt' | 'import', label: string) => h('button', {
      ref: id === 'prompt' ? promptTab : importTab, id: `${props.idPrefix}-tab-${id}`,
      type: 'button', class: 'quiet-button', role: 'tab',
      'aria-selected': tab.value === id, 'aria-controls': `${props.idPrefix}-panel`, tabindex: tab.value === id ? 0 : -1,
      onClick: () => select(id),
      onKeydown: (event: KeyboardEvent) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        select(event.key === 'Home' ? 'prompt' : event.key === 'End' ? 'import' : tab.value === 'prompt' ? 'import' : 'prompt', true);
      },
    }, label);
    return () => h('div', { class: 'ai-exchange' }, [
      h('div', { class: 'ai-exchange-tabs', role: 'tablist', 'aria-label': `${props.label} import method` }, [button('prompt', 'AI Prompt'), button('import', 'JSON Import')]),
      h('div', { class: ['ai-exchange-frame', { 'is-backward': backward.value }] }, [
        h(Transition, { name: 'ai-exchange-panel', mode: 'out-in', onAfterEnter: afterEnter }, {
          default: () => h('section', {
            key: tab.value, id: `${props.idPrefix}-panel`, class: 'ai-exchange-panel', role: 'tabpanel',
            'aria-labelledby': `${props.idPrefix}-tab-${tab.value}`,
          }, tab.value === 'prompt' ? [
            h('p', { class: 'ai-exchange-help' }, props.promptHelp), slots.options?.(), slots.guidance?.(),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: ['card-primary-button ai-exchange-copy', { 'is-copied': copied.value }], onClick: copy }, copied.value ? '✓ Copied!' : 'Copy prompt'),
              h('button', {
                type: 'button', class: 'quiet-button', 'aria-expanded': shown.value,
                'aria-controls': `${props.idPrefix}-prompt`, 'aria-label': shown.value ? 'Hide generated prompt' : 'Show generated prompt',
                onClick: () => { shown.value = !shown.value; },
              }, [h(Icon, { name: shown.value ? 'chevron-up' : 'chevron-down' })]),
              h('span', { role: 'status', class: 'ai-exchange-muted' }, status.value),
            ]),
            h(Transition, { name: 'ai-exchange-reveal' }, { default: () => shown.value ? h('textarea', {
              id: `${props.idPrefix}-prompt`, readonly: true, value: props.prompt, rows: 16, 'aria-label': `${props.label} AI prompt`,
            }) : null }),
          ] : [
            handoff.value === 'waiting' ? h('div', { class: 'ai-exchange-handoff', role: 'status' }, [
              h('strong', 'Prompt copied — send it to your AI.'), h('p', props.importHelp),
              h('button', { ref: ready, type: 'button', class: 'card-primary-button', onClick: responseReady }, 'My AI response is ready'),
            ]) : [
              handoff.value === 'ready' ? h('div', { class: 'ai-exchange-handoff' }, [
                h('strong', 'Bring the JSON back here.'), h('ol', props.readyInstructions.map(step => h('li', step))),
              ]) : h('p', { class: 'ai-exchange-help' }, props.importHelp),
              h('textarea', {
                ref: input, value: props.json, rows: 12, maxlength: props.maxLength,
                placeholder: `Paste your ${props.label} JSON here`, 'aria-label': `${props.label} JSON import`,
                onInput: (event: Event) => emit('update-json', inputValue(event)),
              }),
              h('div', { class: 'ai-exchange-actions' }, [
                h('button', { type: 'button', class: 'quiet-button', disabled: !props.json.trim(), onClick: () => emit('validate') }, props.validateLabel),
                props.problem ? h('span', { role: 'alert', class: 'ai-exchange-error' }, props.problem) : null,
              ]),
              h(Transition, { name: 'ai-exchange-reveal', onAfterEnter: () => preview.value?.focus() }, {
                default: () => props.hasPreview ? h('div', { ref: preview, class: 'ai-exchange-preview', tabindex: -1, 'aria-label': `${props.label} preview` }, slots.preview?.()) : null,
              }),
            ],
          ]),
        }),
      ]),
    ]);
  },
});
