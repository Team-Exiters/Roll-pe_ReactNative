import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { apiUrl } from '@/lib/api';

import { signInWithEmail, signInWithSocial, type EmailCredentials, type SocialProvider } from '@/features/sign-in/api';
import { completeBrowserSignIn, prepareBrowserRequest, type BrowserRequest } from '@/features/sign-in/browser-auth';
import type { SignInSession } from '@/features/sign-in/session';
import { authorizeNative, availableNativeProviders } from '@/features/sign-in/social';

export function useSignIn() {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [browserRequests, setBrowserRequests] = useState<Partial<Record<SocialProvider, BrowserRequest | null>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    if (Platform.OS !== 'web') {
      availableNativeProviders().then((value) => {
        if (active) setProviders(value);
      }).catch(() => { /* A development build with the native SDKs is required. */ });
    }
    // Prepare proofs before the tap; awaiting crypto during a tap can block web popups.
    for (const provider of ['google', 'kakao', 'apple'] as const) {
      prepareBrowserRequest(provider).then((value) => {
        if (active) setBrowserRequests((current) => ({ ...current, [provider]: value }));
      }).catch(() => { /* Leave the button unavailable when configuration is missing. */ });
    }
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<SignInSession | null>) {
    if (busy.current) return null;
    busy.current = true;
    setIsLoading(true);
    try {
      return await action();
    } finally {
      busy.current = false;
      setIsLoading(false);
    }
  }

  function socialSignIn(provider: SocialProvider) {
    return run(async () => {
      const request = browserRequests[provider];
      if (request) {
        setBrowserRequests((current) => ({ ...current, [provider]: null }));
        try {
          return await completeBrowserSignIn(request);
        } finally {
          const next = await prepareBrowserRequest(provider).catch(() => null);
          setBrowserRequests((current) => ({ ...current, [provider]: next }));
        }
      }
      if (!providers.includes(provider)) throw new Error('로그인이 아직 준비되지 않았습니다.');
      const credential = await authorizeNative(provider);
      return credential ? signInWithSocial(provider, credential) : null;
    });
  }

  return {
    isLoading,
    canSignIn: Boolean(apiUrl),
    canUseProvider: (provider: SocialProvider) => Boolean(apiUrl)
      && (providers.includes(provider) || Boolean(browserRequests[provider])),
    emailSignIn: (credentials: EmailCredentials) => run(() => signInWithEmail(credentials)),
    socialSignIn,
  };
}
