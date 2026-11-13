import { browser } from '$app/environment';
import { createStore } from 'zustand/vanilla';

export type Lang = 'ru' | 'en';
export type Theme = 'light' | 'dark';

interface SettingsState {
  lang: Lang;
  theme: Theme;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
}

/** Persistent UI preferences (language, theme). Same localStorage keys as before. */
export const settingsStore = createStore<SettingsState>(set => ({
  lang: browser && localStorage.getItem('lang') === 'en' ? 'en' : 'ru',
  theme: browser && localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  setLang: lang => set({ lang }),
  setTheme: theme => set({ theme }),
}));

settingsStore.subscribe((s, prev) => {
  if (!browser) return;
  if (s.lang !== prev.lang) {
    localStorage.setItem('lang', s.lang);
    // Dev only: if the language ever flips on its own, this stack shows who changed it.
    if (import.meta.env.DEV) console.trace(`[lang] ${prev.lang} → ${s.lang}`);
  }
  if (s.theme !== prev.theme) localStorage.setItem('theme', s.theme);
});
