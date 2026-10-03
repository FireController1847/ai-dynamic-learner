import { defineComponent, h, onBeforeUnmount, ref } from 'vue';
import { ThemePicker } from './theme-picker.ts';

export interface ThemeMenuHandle {
  open(trigger?: EventTarget | null): void;
}

export const ThemeMenu = defineComponent({
  name: 'ThemeMenu',
  setup(_props, { expose }) {
    const dialog = ref<HTMLDialogElement | null>(null);
    let trigger: HTMLElement | null = null;

    function open(source?: EventTarget | null) {
      trigger = source instanceof HTMLElement
        ? source
        : document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.value?.open) dialog.value?.showModal();
    }

    function close() {
      if (dialog.value?.open) dialog.value.close();
    }

    function restoreFocus() {
      const target = trigger;
      trigger = null;
      target?.focus();
    }

    onBeforeUnmount(close);
    expose({ open });

    return () => h('dialog', {
      ref: dialog,
      class: 'theme-menu',
      'aria-labelledby': 'theme-menu-heading',
      onClose: restoreFocus,
      onClick: (event: MouseEvent) => {
        if (event.target === dialog.value) close();
      },
    }, [
      h('section', {
        class: 'theme-menu-card',
        onClick: (event: MouseEvent) => event.stopPropagation(),
      }, [
        h('header', { class: 'theme-menu-header' }, [
          h('div', [
            h('h2', { id: 'theme-menu-heading' }, 'Theme'),
            h('p', 'Choose a theme directly or let your system switch between a light and dark theme.'),
          ]),
          h('button', {
            type: 'button',
            class: 'quiet-button theme-menu-close',
            autofocus: true,
            onClick: close,
          }, 'Close'),
        ]),
        h(ThemePicker),
      ]),
    ]);
  },
});
