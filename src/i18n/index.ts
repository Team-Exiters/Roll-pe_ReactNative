import { createInstance } from 'i18next';
import { initReactI18next, useTranslation as useReactTranslation } from 'react-i18next';

import ko from '@/i18n/locales/ko.json';

export type TranslationKey = keyof typeof ko;
export const supportedLanguages = ['ko'] as const;
export type Language = typeof supportedLanguages[number];

export function preferredLanguage(locales: readonly { languageTag: string }[]): Language {
  for (const locale of locales) {
    const language = locale.languageTag.toLowerCase().split(/[-_]/)[0];
    const supported = supportedLanguages.find(value => value === language);
    if (supported) return supported;
  }
  return 'ko';
}

export const i18n = createInstance();
// Bundled resources initialize synchronously. The initial Korean render is also shared
// by server rendering and hydration; device language is applied after mounting.
void i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko } },
  lng: 'ko', fallbackLng: 'ko', supportedLngs: [...supportedLanguages],
  keySeparator: false, initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export function t(key: TranslationKey, values?: Record<string, unknown>): string {
  return String(i18n.t(key, values));
}

export function useTranslation() {
  const translation = useReactTranslation(undefined, { i18n });
  return { t: translation.t as typeof t, i18n };
}

// These Korean names are legacy API values. Translate their display labels only;
// their IDs and names must remain unchanged when selecting or submitting options.
const choiceKeys = new Map<string, TranslationKey>([
  ['가로', 'choices.horizontal'], ['세로', 'choices.vertical'], ['화이트', 'choices.white'],
  ['추모', 'choices.memorial'], ['축하', 'choices.congrats'],
]);
export function choiceLabel(name: string): string {
  const key = choiceKeys.get(name);
  return key ? t(key) : name;
}
