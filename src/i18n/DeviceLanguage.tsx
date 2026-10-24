import { useLocales } from 'expo-localization';
import { useEffect } from 'react';

import { i18n, preferredLanguage } from '@/i18n';

export function DeviceLanguage() {
  const locales = useLocales();
  const language = preferredLanguage(locales);
  useEffect(() => {
    if (i18n.resolvedLanguage !== language) void i18n.changeLanguage(language);
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }, [language]);
  return null;
}
