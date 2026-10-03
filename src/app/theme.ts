import { readonly, ref } from 'vue';

export type ThemeId = 'light' | 'dark';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  colorScheme: 'light' | 'dark';
  browserColor: string;
}

export const themes: readonly ThemeDefinition[] = Object.freeze([
  { id: 'light', label: 'Light', colorScheme: 'light', browserColor: '#0f6cbd' },
  { id: 'dark', label: 'Dark', colorScheme: 'dark', browserColor: '#1f1f1f' },
]);

const THEME_STORAGE_KEY = 'dynamic-learner.theme';
const themeIds = new Set<ThemeId>(themes.map((theme) => theme.id));
const currentTheme = ref<ThemeId>('light');
let initialized = false;

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIds.has(value as ThemeId);
}

function readSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(saved) ? saved : 'light';
  } catch {
    return 'light';
  }
}

function writeSavedTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* UI preferences are best-effort only. */
  }
}

function applyTheme(theme: ThemeId): void {
  const definition = themes.find((candidate) => candidate.id === theme);
  if (!definition) return;

  document.documentElement.dataset.theme = theme;
  currentTheme.value = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute('content', definition.browserColor);
}

export function initializeTheme(): void {
  if (initialized) return;
  initialized = true;

  applyTheme(readSavedTheme());
  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(isThemeId(event.newValue) ? event.newValue : 'light');
  });
}

export function setTheme(theme: ThemeId): void {
  writeSavedTheme(theme);
  applyTheme(theme);
}

export function useTheme() {
  return {
    themes,
    currentTheme: readonly(currentTheme),
    setTheme,
  };
}
