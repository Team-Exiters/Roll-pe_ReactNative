import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { t } from '@/i18n';
import { apiUrl } from '@/lib/api';

import {
  signInWithEmail,
  signInWithSocial,
  type EmailCredentials,
  type SocialProvider,
} from '@/features/sign-in/api';
import {
  completeBrowserSignIn,
  prepareBrowserRequest,
  type BrowserRequest,
} from '@/features/sign-in/browser-auth';
import type { TokenState } from '@/features/sign-in/token-state';
import { authorizeNative, availableNativeProviders } from '@/features/sign-in/social';

export function useSignIn() {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [browserRequests, setBrowserRequests] = useState<
    Partial<Record<SocialProvider, BrowserRequest | null>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const operation = useRef<AbortController | null>(null);

  useFocusEffect(
    useCallback(
      () => () => {
        operation.current?.abort();
        operation.current = null;
        setIsLoading(false);
      },
      [],
    ),
  );

  useEffect(() => {
    let active = true;
    if (Platform.OS !== 'web') {
      availableNativeProviders()
        .then((value) => {
          if (active) setProviders(value);
        })
        .catch(() => {
          /* A development build with the native SDKs is required. */
        });
    }
    // Prepare an independent state and PKCE proof for each provider before sign-in.
    for (const provider of ['google', 'kakao', 'apple'] as const) {
      prepareBrowserRequest(provider)
        .then((value) => {
          if (active) setBrowserRequests((current) => ({ ...current, [provider]: value }));
        })
        .catch(() => {
          /* Leave the button unavailable when configuration is missing. */
        });
    }
    return () => {
      active = false;
    };
  }, []);

  async function run(action: (signal: AbortSignal) => Promise<TokenState | null>) {
    if (operation.current) return null;
    const controller = new AbortController();
    operation.current = controller;
    setIsLoading(true);
    try {
      const result = await action(controller.signal);
      return controller.signal.aborted ? null : result;
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setIsLoading(false);
      }
    }
  }

  function socialSignIn(provider: SocialProvider) {
    return run(async (signal) => {
      const request = browserRequests[provider];
      if (request) {
        setBrowserRequests((current) => ({ ...current, [provider]: null }));
        try {
          return await completeBrowserSignIn(request, signal);
        } finally {
          const next = await prepareBrowserRequest(provider).catch(() => null);
          setBrowserRequests((current) => ({ ...current, [provider]: next }));
        }
      }
      if (!providers.includes(provider)) throw new Error(t('auth.notReady'));
      const credential = await authorizeNative(provider);
      return credential && !signal.aborted ? signInWithSocial(provider, credential, signal) : null;
    });
  }

  return {
    isLoading,
    canSignIn: Boolean(apiUrl),
    canUseProvider: (provider: SocialProvider) =>
      Boolean(apiUrl) && (providers.includes(provider) || Boolean(browserRequests[provider])),
    emailSignIn: (credentials: EmailCredentials) =>
      run((signal) => signInWithEmail(credentials, signal)),
    socialSignIn,
  };
}
