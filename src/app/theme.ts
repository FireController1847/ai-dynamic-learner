import { readonly, ref } from 'vue';

export type ThemeAppearance = 'light' | 'dark';

export interface ThemeDefinition {
  id: string;
  label: string;
  appearance: ThemeAppearance;
  browserColor: string;
}

export const themes = Object.freeze([
  { id: 'light', label: 'Light', appearance: 'light', browserColor: '#0f6cbd' },
  { id: 'dark', label: 'Dark', appearance: 'dark', browserColor: '#1f1f1f' },
] as const satisfies readonly ThemeDefinition[]);

export type ThemeId = (typeof themes)[number]['id'];

export interface ThemePreferences {
  theme: ThemeId;
  followSystem: boolean;
  lightTheme: ThemeId;
  darkTheme: ThemeId;
}

const THEME_STORAGE_KEY = 'dynamic-learner.theme-preferences';
const LEGACY_THEME_STORAGE_KEY = 'dynamic-learner.theme';
const DEFAULT_PREFERENCES: ThemePreferences = Object.freeze({
  theme: 'light',
  followSystem: false,
  lightTheme: 'light',
  darkTheme: 'dark',
});
const currentTheme = ref<ThemeId>('light');
const preferences = ref<ThemePreferences>({ ...DEFAULT_PREFERENCES });
let initialized = false;
let systemAppearance: MediaQueryList | null = null;

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themes.some((theme) => theme.id === value);
}

function themeHasAppearance(theme: ThemeId, appearance: ThemeAppearance): boolean {
  return themes.some((candidate) => candidate.id === theme && candidate.appearance === appearance);
}

function parsePreferences(value: string | null): ThemePreferences | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const source = parsed as Record<string, unknown>;

    const theme = isThemeId(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme;
    const lightTheme = isThemeId(source.lightTheme) && themeHasAppearance(source.lightTheme, 'light')
      ? source.lightTheme
      : DEFAULT_PREFERENCES.lightTheme;
    const darkTheme = isThemeId(source.darkTheme) && themeHasAppearance(source.darkTheme, 'dark')
      ? source.darkTheme
      : DEFAULT_PREFERENCES.darkTheme;

    return {
      theme,
      followSystem: source.followSystem === true,
      lightTheme,
      darkTheme,
    };
  } catch {
    return null;
  }
}

function readSavedPreferences(): ThemePreferences {
  try {
    const saved = parsePreferences(localStorage.getItem(THEME_STORAGE_KEY));
    if (saved) return saved;

    const legacyTheme = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    return isThemeId(legacyTheme)
      ? { ...DEFAULT_PREFERENCES, theme: legacyTheme }
      : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function writePreferences(value: ThemePreferences): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(value));
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  } catch {
    /* UI preferences are best-effort only. */
  }
}

function resolvedTheme(value: ThemePreferences): ThemeId {
  if (!value.followSystem) return value.theme;
  return systemAppearance?.matches ? value.darkTheme : value.lightTheme;
}

function applyTheme(theme: ThemeId): void {
  const definition = themes.find((candidate) => candidate.id === theme);
  if (!definition) return;

  document.documentElement.dataset.theme = theme;
  currentTheme.value = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute('content', definition.browserColor);
}

function applyPreferences(value: ThemePreferences, save = true): void {
  preferences.value = value;
  if (save) writePreferences(value);
  applyTheme(resolvedTheme(value));
}

function updatePreferences(change: Partial<ThemePreferences>): void {
  applyPreferences({ ...preferences.value, ...change });
}

export function initializeTheme(): void {
  if (initialized) return;
  initialized = true;

  systemAppearance = window.matchMedia('(prefers-color-scheme: dark)');
  applyPreferences(readSavedPreferences());

  systemAppearance.addEventListener('change', () => {
    if (preferences.value.followSystem) applyTheme(resolvedTheme(preferences.value));
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyPreferences(parsePreferences(event.newValue) ?? { ...DEFAULT_PREFERENCES }, false);
  });
}

export function setTheme(theme: ThemeId): void {
  updatePreferences({ theme });
}

export function setFollowSystem(followSystem: boolean): void {
  updatePreferences({ followSystem });
}

export function setLightTheme(lightTheme: ThemeId): void {
  if (themeHasAppearance(lightTheme, 'light')) updatePreferences({ lightTheme });
}

export function setDarkTheme(darkTheme: ThemeId): void {
  if (themeHasAppearance(darkTheme, 'dark')) updatePreferences({ darkTheme });
}

export function useTheme() {
  return {
    themes,
    currentTheme: readonly(currentTheme),
    preferences: readonly(preferences),
    setTheme,
    setFollowSystem,
    setLightTheme,
    setDarkTheme,
  };
}
