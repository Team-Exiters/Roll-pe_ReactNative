import type { View } from 'react-native';
import type { ComponentRef } from 'react';

import { t } from '@/i18n';

export async function saveRollpeImage(
  node: ComponentRef<typeof View> | null,
  fileName: string,
): Promise<void> {
  if (!node || typeof document === 'undefined') throw new Error(t('info.saveFailed'));
  await document.fonts.ready;
  const { toPng } = await import('html-to-image');
  const url = await toPng(node as unknown as HTMLElement, { pixelRatio: 2 });
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.png`;
  link.click();
}
