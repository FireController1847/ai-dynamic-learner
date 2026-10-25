import { defineComponent, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, Transition, useId, type PropType } from 'vue';
import { Icon } from '../../../components/icon.ts';

export interface PublicationOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  fontFamily?: string;
}

/** Feature-local document toolbar menu with native buttons and keyboard navigation. */
export const PublicationDropdown = defineComponent({
  name: 'PublicationDropdown',
  props: {
    label: { type: String, required: true }, icon: { type: String, required: true },
    value: { type: String, required: true },
    options: { type: Array as PropType<readonly PublicationOption[]>, required: true },
  },
  emits: { select: (_id: string) => true },
  setup(props, { emit }) {
    const id = `publication-menu-${useId()}`;
    const root = ref<HTMLElement | null>(null);
    const trigger = ref<HTMLButtonElement | null>(null);
    const menu = ref<HTMLElement | null>(null);
    const open = ref(false);
    function close(restoreFocus = false) {
      open.value = false;
      if (restoreFocus) trigger.value?.focus();
    }
    function focus(index: number) {
      const buttons = menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
      if (buttons?.length) buttons[(index + buttons.length) % buttons.length]?.focus();
    }
    async function expand(last = false) {
      open.value = true;
      await nextTick();
      const bounds = menu.value?.getBoundingClientRect();
      const boundary = root.value?.closest('.review-publication')?.getBoundingClientRect();
      if (bounds && boundary && menu.value) {
        const right = Math.min(window.innerWidth, boundary.right) - 8;
        const left = Math.max(0, boundary.left) + 8;
        const offset = Math.max(left - bounds.left, Math.min(0, right - bounds.right));
        menu.value.style.setProperty('--publication-menu-offset', `${offset}px`);
      }
      const selected = props.options.findIndex(option => option.id === props.value);
      focus(last ? props.options.length - 1 : Math.max(0, selected));
    }
    function outside(event: PointerEvent) {
      if (open.value && event.target instanceof Node && !root.value?.contains(event.target)) close();
    }
    onMounted(() => document.addEventListener('pointerdown', outside));
    onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
    onDeactivated(() => close());

    function navigate(event: KeyboardEvent) {
      const buttons = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
      const index = buttons.findIndex(button => button === document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') close();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        focus(event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== ' ') {
        const match = props.options.findIndex(option => option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
        if (match >= 0) { event.preventDefault(); focus(match); }
      }
    }

    return () => {
      const selected = props.options.find(option => option.id === props.value);
      return h('div', { ref: root, class: ['publication-dropdown', { 'is-open': open.value }],
        onFocusout: (event: FocusEvent) => {
          if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) close();
        },
      }, [
        h('button', { ref: trigger, type: 'button', class: 'quiet-button publication-tool', title: props.label,
          'aria-label': `${props.label}: ${selected?.label ?? props.value}`, 'aria-haspopup': 'menu',
          'aria-expanded': open.value, 'aria-controls': id,
          onClick: () => { if (open.value) close(); else void expand(); },
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); void expand(event.key === 'ArrowUp');
            } else if (event.key === 'Escape') close();
          },
        }, [h(Icon, { name: selected?.icon ?? props.icon }),
          h('span', { class: 'publication-tool-value', style: { fontFamily: selected?.fontFamily } }, selected?.label ?? props.value),
          h(Icon, { name: 'chevron-down', class: 'publication-tool-chevron' })]),
        h(Transition, { name: 'publication-menu', onBeforeLeave: (element: Element) => {
          if (element instanceof HTMLElement) element.inert = true;
        }, onLeaveCancelled: (element: Element) => {
          if (element instanceof HTMLElement) element.inert = false;
        } }, { default: () => open.value ? h('div', {
          ref: menu, id, role: 'menu', 'aria-label': props.label, class: 'publication-menu', onKeydown: navigate,
        }, props.options.map(option => h('button', {
          key: option.id, type: 'button', role: 'menuitemradio', tabindex: -1,
          'aria-checked': option.id === props.value, class: 'publication-menu-option',
          onClick: () => { emit('select', option.id); close(true); },
        }, [h(Icon, { name: option.icon ?? props.icon }),
          h('span', { class: 'publication-menu-copy' }, [
            h('span', { style: { fontFamily: option.fontFamily } }, option.label),
            option.description ? h('small', option.description) : null,
          ]), option.id === props.value ? h(Icon, { name: 'check', class: 'publication-menu-check' }) : null]))) : null }),
      ]);
    };
  },
});
