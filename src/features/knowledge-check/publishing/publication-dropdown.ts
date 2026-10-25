import { defineComponent, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, Teleport, Transition, useId, type PropType } from 'vue';
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
    const menuPosition = ref({ top: 0, left: 0 });
    let toolbar: Element | null = null;
    function inside(target: Node | null): boolean {
      return Boolean(target && (root.value?.contains(target) || menu.value?.contains(target)));
    }
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
      const anchor = trigger.value?.getBoundingClientRect();
      const bounds = menu.value?.getBoundingClientRect();
      if (anchor && bounds) {
        const left = Math.max(8, Math.min(anchor.left, window.innerWidth - bounds.width - 8));
        const below = anchor.bottom + 6;
        const top = below + bounds.height + 8 <= window.innerHeight
          ? below : Math.max(8, anchor.top - bounds.height - 6);
        menuPosition.value = { top, left };
      }
      const selected = props.options.findIndex(option => option.id === props.value);
      focus(last ? props.options.length - 1 : Math.max(0, selected));
    }
    function outside(event: PointerEvent) {
      if (open.value && event.target instanceof Node && !inside(event.target)) close();
    }
    const closeOnScroll = () => close();
    onMounted(() => {
      document.addEventListener('pointerdown', outside);
      toolbar = root.value?.closest('.review-publication-toolbar-scroll') ?? null;
      toolbar?.addEventListener('scroll', closeOnScroll, { passive: true });
      window.addEventListener('resize', closeOnScroll);
    });
    onBeforeUnmount(() => {
      document.removeEventListener('pointerdown', outside);
      toolbar?.removeEventListener('scroll', closeOnScroll);
      window.removeEventListener('resize', closeOnScroll);
    });
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
          if (!(event.relatedTarget instanceof Node) || !inside(event.relatedTarget)) close();
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
        h(Teleport, { to: 'body' }, [h(Transition, { name: 'publication-menu', onBeforeLeave: (element: Element) => {
          if (element instanceof HTMLElement) element.inert = true;
        }, onLeaveCancelled: (element: Element) => {
          if (element instanceof HTMLElement) element.inert = false;
        } }, { default: () => open.value ? h('div', {
          ref: menu, id, role: 'menu', 'aria-label': props.label, class: 'publication-menu',
          style: { top: `${menuPosition.value.top}px`, left: `${menuPosition.value.left}px` },
          onKeydown: navigate,
          onFocusout: (event: FocusEvent) => {
            if (!(event.relatedTarget instanceof Node) || !inside(event.relatedTarget)) close();
          },
        }, props.options.map(option => h('button', {
          key: option.id, type: 'button', role: 'menuitemradio', tabindex: -1,
          'aria-checked': option.id === props.value, class: 'publication-menu-option',
          onClick: () => { emit('select', option.id); close(true); },
        }, [h(Icon, { name: option.icon ?? props.icon }),
          h('span', { class: 'publication-menu-copy' }, [
            h('span', { style: { fontFamily: option.fontFamily } }, option.label),
            option.description ? h('small', option.description) : null,
          ]), option.id === props.value ? h(Icon, { name: 'check', class: 'publication-menu-check' }) : null]))) : null })]),
      ]);
    };
  },
});
