import { resetCredentials, resetLinkOrigin } from '@/utils/reset-link';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    const url = new URL(path, 'rollpe:///');
    const apiOrigin = resetLinkOrigin(process.env.EXPO_PUBLIC_API_URL);
    // Email reset links use a verified HTTPS app link. Never accept the token in a query.
    if (apiOrigin && url.protocol === 'https:' && url.hostname === new URL(apiOrigin).hostname
      && url.pathname.startsWith('/api/user/password-reset/')) {
      const identifyCode = /^\/api\/user\/password-reset\/([^/]+)$/.exec(url.pathname)?.[1];
      const fragment = new URLSearchParams(url.hash.slice(1));
      const credentials = resetCredentials({ identifyCode, token: fragment.get('token') });
      if (url.origin !== apiOrigin || url.username || url.password || url.search
        || fragment.getAll('token').length !== 1 || [...fragment.keys()].some((key) => key !== 'token')
        || !credentials) return '/reset-password';
      return `/reset-password?identifyCode=${credentials.identifyCode}&token=${encodeURIComponent(credentials.token)}`;
    }
    const kakaoKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
    // Also recognize callbacks from development builds installed before the scheme change.
    const isAppScheme = url.protocol === 'rollpe:' || url.protocol === 'reactnativerollpe:';
    const isKakaoScheme = Boolean(kakaoKey) && url.protocol === `kakao${kakaoKey}:`;
    const callbackPath = `${url.host}${url.pathname}`.replace(/^\/+|\/+$/g, '');
    if ((isAppScheme || isKakaoScheme) && callbackPath === 'oauth'
      && (url.searchParams.has('code') || url.searchParams.has('error'))) {
      // The Kakao SDK handles this response. Keep the current screen and pending login intact.
      // A cold launch has no pending JS login to resume, so start a fresh attempt from sign-in.
      return initial ? '/sign-in' : null;
    }
  } catch {
    // Preserve the router's existing handling for malformed or unrelated links.
  }
  return path;
}
