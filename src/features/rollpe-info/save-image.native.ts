import { requestPermissionsAsync, saveToLibraryAsync } from 'expo-media-library/legacy';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import type { View } from 'react-native';
import type { ComponentRef } from 'react';

import { t } from '@/i18n';

export async function saveRollpeImage(node: ComponentRef<typeof View> | null, fileName: string): Promise<void> {
  if (!node) throw new Error(t('info.saveFailed'));
  const permission = await requestPermissionsAsync(true, []);
  if (!permission.granted) throw new Error(t('info.photoPermissionDenied'));
  const uri = await captureRef(node, { format: 'png', quality: 1, result: 'tmpfile', fileName, useRenderInContext: true });
  try { await saveToLibraryAsync(uri); }
  finally { releaseCapture(uri); }
}
