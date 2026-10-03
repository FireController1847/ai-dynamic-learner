import { defineComponent, h } from 'vue';
import { type ThemeId, useTheme } from './theme.ts';

export const ThemePicker = defineComponent({
  name: 'ThemePicker',
  setup() {
    const theme = useTheme();

    return () => h('section', {
      class: 'theme-picker',
      'aria-labelledby': 'theme-picker-heading',
    }, [
      h('h2', { id: 'theme-picker-heading', class: 'theme-picker-heading' }, 'Appearance'),
      h('label', { class: 'theme-picker-field' }, [
        h('span', 'Theme'),
        h('select', {
          value: theme.currentTheme.value,
          onChange: (event: Event) => {
            if (event.target instanceof HTMLSelectElement) {
              theme.setTheme(event.target.value as ThemeId);
            }
          },
        }, theme.themes.map((option) => h('option', {
          key: option.id,
          value: option.id,
        }, option.label))),
      ]),
    ]);
  },
});
