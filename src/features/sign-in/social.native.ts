import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { SocialCredential, SocialProvider } from './api';

function randomSecret() {
  return Array.from(Crypto.getRandomBytes(32), (value) => value.toString(16).padStart(2, '0')).join('');
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
}

export async function availableNativeProviders(): Promise<SocialProvider[]> {
  const providers: SocialProvider[] = [];
  const googleClientId = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (googleClientId) providers.push('google');
  if (process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY) providers.push('kakao');
  if (Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true') {
    try {
      const Apple = await import('expo-apple-authentication');
      if (await Apple.isAvailableAsync()) providers.push('apple');
    } catch {
      // An unavailable Apple module must not disable Google or Kakao.
    }
  }
  return providers;
}

export async function authorizeNative(provider: SocialProvider): Promise<SocialCredential | null> {
  try {
    switch (provider) {
      case 'google': {
        const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
        if (Platform.OS === 'android') {
          if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) throw new Error('구글 로그인 설정이 없습니다.');
          // Android uses the web client as the audience of tokens sent to our API.
          GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        } else {
          // Preserve the original iOS audience expected by existing server clients.
          GoogleSignin.configure({ iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
        }
        const result = await GoogleSignin.signIn();
        if (!isSuccessResponse(result)) return null;
        if (!result.data.idToken) throw new Error('Google 인증 정보를 받지 못했습니다.');
        // The existing iOS API verifies a Google ID token, despite its accessToken field name.
        return { accessToken: result.data.idToken };
      }
      case 'kakao': {
        const Kakao = await import('@react-native-seoul/kakao-login');
        // The SDK falls back to account login when KakaoTalk is not installed.
        const result = await Kakao.login();
        if (!result.accessToken) throw new Error('카카오 인증 정보를 받지 못했습니다.');
        return { accessToken: result.accessToken };
      }
      case 'apple': {
        if (Platform.OS !== 'ios') throw new Error('애플 로그인은 브라우저에서 진행해주세요.');
        const Apple = await import('expo-apple-authentication');
        const state = randomSecret();
        const nonce = randomSecret();
        const result = await Apple.signInAsync({
          requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
          state, nonce,
        });
        if (result.state !== state || !result.identityToken || !result.authorizationCode) {
          throw new Error('Apple 로그인 응답을 확인할 수 없습니다.');
        }
        return {
          accessToken: result.identityToken,
          code: result.authorizationCode,
          nonce,
          ...(result.fullName ? { name: Apple.formatFullName(result.fullName) } : {}),
        };
      }
    }
  } catch (error) {
    const code = errorCode(error);
    if (['ERR_REQUEST_CANCELED', 'SIGN_IN_CANCELLED', 'E_CANCELLED_OPERATION', 'userCancelled'].includes(code)) {
      return null;
    }
    // Both SDKs report cancellation under the shared RNKakaoLogins code.
    if (provider === 'kakao' && code === 'RNKakaoLogins' && error instanceof Error
      && /ClientFailed\(Cancelled\)|AuthFailed\(AccessDenied\)|\b[Cc]ancelled\b/.test(error.message)) return null;
    if (code === 'IN_PROGRESS') throw new Error('이미 로그인이 진행 중입니다.');
    throw error;
  }
}
