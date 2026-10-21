import type { SocialCredential, SocialProvider } from '@/features/sign-in/api';

// All web providers use the server browser flow in browser-auth.ts.
export async function availableNativeProviders(): Promise<SocialProvider[]> {
  return [];
}

export async function authorizeNative(_provider: SocialProvider): Promise<SocialCredential | null> {
  throw new Error('이 기기의 소셜 로그인 설정이 아직 준비되지 않았습니다.');
}
