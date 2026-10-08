import { defineComponent, h } from 'vue';
import { type ThemeDefinition, type ThemeId, useTheme } from './theme.ts';

export const ThemePicker = defineComponent({
  name: 'ThemePicker',
  setup() {
    const theme = useTheme();
    const lightThemes = theme.themes.filter((option) => option.appearance === 'light');
    const darkThemes = theme.themes.filter((option) => option.appearance === 'dark');

    const select = (
      value: ThemeId,
      options: readonly ThemeDefinition[],
      onChange: (theme: ThemeId) => void,
    ) => h('select', {
      value,
      onChange: (event: Event) => {
        if (event.target instanceof HTMLSelectElement) onChange(event.target.value as ThemeId);
      },
    }, options.map((option) => h('option', {
      key: option.id,
      value: option.id,
    }, option.label)));

    const field = (
      label: string,
      value: ThemeId,
      options: readonly ThemeDefinition[],
      onChange: (theme: ThemeId) => void,
    ) => h('label', { class: 'theme-picker-field' }, [
      h('span', label),
      select(value, options, onChange),
    ]);

    return () => h('section', {
      class: 'theme-picker',
      'aria-label': 'Theme settings',
    }, [
      h('label', { class: 'theme-picker-system' }, [
        h('input', {
          type: 'checkbox',
          checked: theme.preferences.value.followSystem,
          onChange: (event: Event) => {
            if (event.target instanceof HTMLInputElement) theme.setFollowSystem(event.target.checked);
          },
        }),
        h('span', { class: 'theme-picker-system-label' }, 'Follow system'),
      ]),
      theme.preferences.value.followSystem
        ? h('div', { class: 'theme-picker-roles' }, [
          field('Light', theme.preferences.value.lightTheme, lightThemes, theme.setLightTheme),
          field('Dark', theme.preferences.value.darkTheme, darkThemes, theme.setDarkTheme),
        ])
        : field('Theme', theme.preferences.value.theme, theme.themes, theme.setTheme),
    ]);
  },
});
