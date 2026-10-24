import { t } from '@/i18n';
import type { SocialCredential, SocialProvider } from '@/features/sign-in/api';

// All web providers use the server browser flow in browser-auth.ts.
export async function availableNativeProviders(): Promise<SocialProvider[]> {
  return [];
}

export async function authorizeNative(_provider: SocialProvider): Promise<SocialCredential | null> {
  throw new Error(t('auth.socialNotReady'));
}
