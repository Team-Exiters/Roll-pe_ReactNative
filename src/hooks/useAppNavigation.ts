import { useNavigation } from 'expo-router';
import { CommonActions, type NavigationState } from 'expo-router/react-navigation';
import { useCallback } from 'react';

import { rollpeDestination } from '@/utils/rollpe-link';

type Route = { name: string; key?: string; params?: object };
type MainScreen = 'home' | 'search' | 'my-page';

export function useAppNavigation() {
  const navigation = useNavigation('/');
  const reset = useCallback(
    (state: NavigationState, routes: Route[]) => {
      // SDK 58 requires a complete state. Keep the navigator metadata and let it mint new keys.
      navigation.dispatch({
        ...CommonActions.reset({ ...state, index: routes.length - 1, routes }),
        target: state.key,
      });
    },
    [navigation],
  );

  const openSignIn = useCallback(
    (returnTo?: unknown) => {
      const state = navigation.getState();
      if (!state) return;
      const first = state.routes[0];
      const current = state.routes[state.index];
      // Preserve the form when returning from registration/recovery, or anchoring a direct link.
      const previous =
        current.name === 'sign-in'
          ? current
          : first.name === 'index' && state.routes[1]?.name === 'sign-in'
            ? state.routes[1]
            : undefined;
      const destination =
        rollpeDestination(returnTo) ??
        rollpeDestination(
          previous?.params && 'returnTo' in previous.params ? previous.params.returnTo : undefined,
        );
      const welcome: Route = {
        name: 'index',
        key: first.name === 'index' ? first.key : undefined,
        params: { welcome: 'true' },
      };
      const signIn: Route = {
        name: 'sign-in',
        key: previous?.key,
        params: destination ? { returnTo: destination } : {},
      };
      if (
        state.routes.length === 2 &&
        state.index === 1 &&
        first.name === 'index' &&
        first.params &&
        'welcome' in first.params &&
        first.params.welcome === 'true' &&
        current.name === 'sign-in' &&
        rollpeDestination(
          current.params && 'returnTo' in current.params ? current.params.returnTo : undefined,
        ) === destination
      )
        return;
      reset(state, [welcome, signIn]);
    },
    [navigation, reset],
  );

  const finishSignIn = useCallback(
    (returnTo?: unknown) => {
      const state = navigation.getState();
      if (!state) return;
      const destination = rollpeDestination(returnTo);
      reset(state, [
        { name: 'home' },
        ...(destination
          ? [{ name: 'rollpe/[code]', params: { code: destination.slice('/rollpe/'.length) } }]
          : []),
      ]);
    },
    [navigation, reset],
  );

  const openWelcome = useCallback(() => {
    const state = navigation.getState();
    if (state) reset(state, [{ name: 'index', params: { welcome: 'true' } }]);
  }, [navigation, reset]);

  const openMainScreen = useCallback(
    (screen: MainScreen = 'home') => {
      const state = navigation.getState();
      if (!state) return;
      const home = state.routes.find((route) => route.name === 'home') ?? { name: 'home' };
      const selected = state.routes.find((route) => route.name === screen) ?? { name: screen };
      reset(state, screen === 'home' ? [home] : [home, selected]);
    },
    [navigation, reset],
  );

  return { openSignIn, finishSignIn, openWelcome, openMainScreen };
}
