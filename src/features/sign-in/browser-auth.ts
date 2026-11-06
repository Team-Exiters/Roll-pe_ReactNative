import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { t } from '@/i18n';
import { apiUrl } from '@/lib/api';

import { requestSignIn, type SocialProvider } from '@/features/sign-in/api';
import type { TokenState } from '@/features/sign-in/token-state';

export type BrowserRequest = {
  provider: SocialProvider;
  state: string;
  verifier: string;
  returnUrl: string;
  authorizationUrl: string;
  exchangeUrl: string;
};

const names = { google: 'auth.google', kakao: 'auth.kakao', apple: 'auth.apple' } as const;
const pendingKey = 'rollpe.browser-auth';
const requestLifetime = 10 * 60 * 1000;

function browserEndpoints(provider: SocialProvider) {
  const returnUrl =
    Platform.OS === 'web'
      ? `${window.location.origin}/auth/${provider}`
      : `rollpe://auth/${provider}`;
  const base = `${apiUrl}/api/user/social/login/${provider}`;
  return { returnUrl, exchangeUrl: `${base}/exchange`, startUrl: `${base}/start` };
}

function randomSecret() {
  return Array.from(Crypto.getRandomBytes(32), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function prepareBrowserRequest(
  provider: SocialProvider,
): Promise<BrowserRequest | null> {
  if (!apiUrl) return null;
  if (provider === 'apple') {
    if (Platform.OS === 'ios' || process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED !== 'true')
      return null;
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
  const { returnUrl, exchangeUrl, startUrl } = browserEndpoints(provider);
  const params = new URLSearchParams({ return_url: returnUrl, state, code_challenge: challenge });
  return {
    provider,
    verifier,
    state,
    returnUrl,
    authorizationUrl: `${startUrl}?${params.toString()}`,
    exchangeUrl,
  };
}

export async function completeBrowserSignIn(
  request: BrowserRequest,
  signal?: AbortSignal,
): Promise<TokenState | null> {
  if (signal?.aborted) return null;
  if (Platform.OS === 'web') {
    // Keep the proof in this tab across the redirect. No popup/opener connection is needed.
    try {
      window.sessionStorage.setItem(
        pendingKey,
        JSON.stringify({
          provider: request.provider,
          state: request.state,
          verifier: request.verifier,
          expiresAt: Date.now() + requestLifetime,
        }),
      );
    } catch {
      throw new Error(t('auth.storageUnavailable'));
    }
    try {
      window.location.assign(request.authorizationUrl);
    } catch {
      window.sessionStorage.removeItem(pendingKey);
      throw new Error(t('auth.failed'));
    }
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(request.authorizationUrl, request.returnUrl);
  if (signal?.aborted || result.type !== 'success') return null;
  return exchangeBrowserReturn(request, result.url, signal);
}

export async function completeWebBrowserSignIn(signal?: AbortSignal): Promise<TokenState | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || signal?.aborted) return null;
  const callbackUrl = window.location.href;
  // Remove the one-time code from the address bar/history before making a network request.
  window.history.replaceState(null, '', window.location.pathname);
  window.document.title = t('common.brand');
  let pending: {
    provider?: unknown;
    state?: unknown;
    verifier?: unknown;
    expiresAt?: unknown;
  } | null;
  try {
    const stored = window.sessionStorage.getItem(pendingKey);
    window.sessionStorage.removeItem(pendingKey);
    pending = stored ? JSON.parse(stored) : null;
  } catch {
    throw new Error(t('auth.callbackFailed'));
  }
  const now = Date.now();
  if (
    !apiUrl ||
    !pending ||
    !['apple', 'google', 'kakao'].includes(pending.provider as string) ||
    typeof pending.state !== 'string' ||
    !/^[a-f0-9]{64}$/.test(pending.state) ||
    typeof pending.verifier !== 'string' ||
    !/^[a-f0-9]{64}$/.test(pending.verifier) ||
    typeof pending.expiresAt !== 'number' ||
    !Number.isFinite(pending.expiresAt) ||
    pending.expiresAt <= now ||
    pending.expiresAt > now + requestLifetime
  ) {
    throw new Error(t('auth.callbackFailed'));
  }
  const provider = pending.provider as SocialProvider;
  return exchangeBrowserReturn(
    {
      provider,
      state: pending.state,
      ...browserEndpoints(provider),
      verifier: pending.verifier,
    },
    callbackUrl,
    signal,
  );
}

async function exchangeBrowserReturn(
  request: Pick<BrowserRequest, 'provider' | 'state' | 'verifier' | 'returnUrl' | 'exchangeUrl'>,
  url: string,
  signal?: AbortSignal,
): Promise<TokenState | null> {
  const returned = new URL(url);
  const destination = new URL(request.returnUrl);
  const params = returned.searchParams;
  if (
    returned.protocol !== destination.protocol ||
    returned.host !== destination.host ||
    returned.pathname !== destination.pathname ||
    returned.hash ||
    returned.username ||
    returned.password ||
    params.getAll('state').length !== 1 ||
    params.get('state') !== request.state ||
    params.getAll('error').length > 1 ||
    params.getAll('code').length > 1 ||
    (params.has('error') && params.has('code'))
  ) {
    throw new Error(t('auth.requestInvalid'));
  }
  if (params.has('error')) {
    const error = params.get('error');
    if (error === 'cancelled') return null;
    if (error === 'email_required') throw new Error(t('auth.emailRequired'));
    if (error === 'account_conflict') throw new Error(t('auth.accountConflict'));
    if (error === 'account_inactive') throw new Error(t('auth.accountInactive'));
    throw new Error(t('auth.providerFailed', { provider: t(names[request.provider]) }));
  }
  const code = params.get('code');
  if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
    throw new Error(t('auth.responseInvalid'));
  }
  return requestSignIn(
    request.exchangeUrl,
    { code, code_verifier: request.verifier },
    true,
    request.provider,
    signal,
  );
}
