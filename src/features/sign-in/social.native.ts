import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import type { SocialCredential, SocialProvider } from '@/features/sign-in/api';

function randomSecret() {
  return Array.from(Crypto.getRandomBytes(32), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
}

export async function availableNativeProviders(): Promise<SocialProvider[]> {
  const providers: SocialProvider[] = [];
  const googleClientId =
    Platform.OS === 'ios'
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
        const { GoogleSignin, isSuccessResponse } =
          await import('@react-native-google-signin/google-signin');
        if (Platform.OS === 'android') {
          if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
            throw new Error(t('auth.googleMissing'));
          // Android uses the web client as the audience of tokens sent to our API.
          GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        } else {
          // Use the iOS client registered for this bundle; the server must accept its audience.
          GoogleSignin.configure({ iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
        }
        const result = await GoogleSignin.signIn();
        if (!isSuccessResponse(result)) return null;
        if (!result.data.idToken) throw new Error(t('auth.googleTokenMissing'));
        // The existing iOS API verifies a Google ID token, despite its accessToken field name.
        return { accessToken: result.data.idToken };
      }
      case 'kakao': {
        const Kakao = await import('@react-native-seoul/kakao-login');
        // The SDK falls back to account login when KakaoTalk is not installed.
        const result = await Kakao.login();
        if (!result.accessToken) throw new Error(t('auth.kakaoTokenMissing'));
        return { accessToken: result.accessToken };
      }
      case 'apple': {
        if (Platform.OS !== 'ios') throw new Error(t('auth.appleBrowser'));
        const Apple = await import('expo-apple-authentication');
        const state = randomSecret();
        const nonce = randomSecret();
        const result = await Apple.signInAsync({
          requestedScopes: [
            Apple.AppleAuthenticationScope.FULL_NAME,
            Apple.AppleAuthenticationScope.EMAIL,
          ],
          state,
          nonce,
        });
        if (result.state !== state || !result.identityToken || !result.authorizationCode) {
          throw new Error(t('auth.appleResponseInvalid'));
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
    if (
      [
        'ERR_REQUEST_CANCELED',
        'SIGN_IN_CANCELLED',
        'E_CANCELLED_OPERATION',
        'userCancelled',
      ].includes(code)
    ) {
      return null;
    }
    // Both SDKs report cancellation under the shared RNKakaoLogins code.
    if (
      provider === 'kakao' &&
      code === 'RNKakaoLogins' &&
      error instanceof Error &&
      /ClientFailed\(Cancelled\)|AuthFailed\(AccessDenied\)|\b[Cc]ancelled\b/.test(error.message)
    )
      return null;
    if (code === 'IN_PROGRESS') throw new Error(t('auth.inProgress'));
    throw error;
  }
}
