import * as Clipboard from 'expo-clipboard';

import { rollpeShareUrl } from '@/features/rollpe-info/model';
import { t } from '@/i18n';

export async function copyRollpeLink(code: string, website?: string): Promise<void> {
  const url = rollpeShareUrl(code, website, process.env.EXPO_PUBLIC_API_URL);
  try {
    if (!await Clipboard.setStringAsync(url)) throw new Error();
  } catch {
    throw new Error(t('info.copyFailed'));
  }
}
