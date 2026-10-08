import { defineComponent, h, ref } from 'vue';
import { PopupDialog } from '../components/popup-dialog.ts';
import { ThemePicker } from './theme-picker.ts';

export interface ThemeMenuHandle {
  open(trigger?: EventTarget | null): void;
}

export const ThemeMenu = defineComponent({
  name: 'ThemeMenu',
  setup(_props, { expose }) {
    const openState = ref(false);
    let trigger: HTMLElement | null = null;

    function open(source?: EventTarget | null) {
      trigger = source instanceof HTMLElement
        ? source
        : document.activeElement instanceof HTMLElement ? document.activeElement : null;
      openState.value = true;
    }

    function close() {
      openState.value = false;
    }

    expose({ open });

    return () => openState.value ? h(PopupDialog, {
      title: 'Theme',
      headingId: 'theme-menu-heading',
      returnFocus: trigger,
      onClose: close,
    }, { default: () => h(ThemePicker) }) : null;
  },
});
