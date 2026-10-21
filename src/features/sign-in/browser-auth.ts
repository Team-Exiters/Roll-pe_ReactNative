import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { apiUrl } from '@/lib/api';

import { requestSession, type SocialProvider } from '@/features/sign-in/api';
import type { SignInSession } from '@/features/sign-in/session';

export type BrowserRequest = {
  provider: SocialProvider;
  state: string;
  verifier: string;
  returnUrl: string;
  authorizationUrl: string;
  exchangeUrl: string;
};

const names = { google: '구글', kakao: '카카오', apple: '애플' };

function randomSecret() {
  return Array.from(Crypto.getRandomBytes(32), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function prepareBrowserRequest(provider: SocialProvider): Promise<BrowserRequest | null> {
  if (!apiUrl) return null;
  if (provider === 'apple') {
    if (Platform.OS === 'ios' || process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED !== 'true') return null;
  } else if (Platform.OS !== 'web') {
    return null;
  }
  // Google/Kakao web credentials are configured by the API server.
  if (Platform.OS === 'web' && typeof window === 'undefined') return null;

  const verifier = randomSecret();
  const state = randomSecret();
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const returnUrl = Platform.OS === 'web'
    ? `${window.location.origin}/auth/${provider}`
    : `rollpe://auth/${provider}`;
  const params = new URLSearchParams({ return_url: returnUrl, state, code_challenge: challenge });
  const base = `${apiUrl}/api/user/social/login/${provider}`;
  return {
    provider, verifier, state, returnUrl,
    authorizationUrl: `${base}/start?${params.toString()}`,
    exchangeUrl: `${base}/exchange`,
  };
}

export async function completeBrowserSignIn(request: BrowserRequest): Promise<SignInSession | null> {
  // Called before any await in the tap handler, so browsers allow the popup.
  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(request.authorizationUrl, request.returnUrl);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_WEB_BROWSER_BLOCKED') {
      throw new Error('로그인 팝업을 열지 못했습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해주세요.');
    }
    throw error;
  }
  if (result.type !== 'success') return null;
  const returned = new URL(result.url);
  const destination = new URL(request.returnUrl);
  const params = returned.searchParams;
  if (returned.protocol !== destination.protocol || returned.host !== destination.host
    || returned.pathname !== destination.pathname || returned.hash || returned.username || returned.password
    || params.getAll('state').length !== 1 || params.get('state') !== request.state
    || params.getAll('error').length > 1 || params.getAll('code').length > 1
    || (params.has('error') && params.has('code'))) {
    throw new Error('로그인 요청을 확인할 수 없습니다. 다시 시도해주세요.');
  }
  if (params.has('error')) {
    const error = params.get('error');
    if (error === 'cancelled') return null;
    if (error === 'email_required') throw new Error('로그인하려면 이메일 제공에 동의해주세요.');
    if (error === 'account_conflict') throw new Error('이미 다른 로그인 방식으로 가입된 이메일입니다.');
    if (error === 'account_inactive') throw new Error('로그인할 수 없는 계정입니다.');
    throw new Error(`${names[request.provider]} 로그인에 실패했습니다. 다시 시도해주세요.`);
  }
  const code = params.get('code');
  if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
    throw new Error('로그인 응답을 확인할 수 없습니다.');
  }
  return requestSession(request.exchangeUrl, { code, code_verifier: request.verifier }, true, request.provider);
}
