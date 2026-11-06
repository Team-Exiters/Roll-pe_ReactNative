import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { LoadingView } from '@/components/ui/LoadingView';
import { AppDialog } from '@/components/ui/AppDialog';
import { useRollpeColors } from '@/constants/theme';
import WelcomeScreen from '@/features/welcome/WelcomeScreen';
import { restoreTokenState } from '@/lib/authenticated-api';
import {
  clearPendingRollpeDestination,
  getPendingRollpeDestination,
} from '@/features/sign-in/pending-rollpe';
import { useAppNavigation } from '@/hooks/useAppNavigation';

export default function StartupGate() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  const { finishSignIn } = useAppNavigation();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'checking' | 'welcome' | 'error'>(
    welcome === 'true' ? 'welcome' : 'checking',
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      let active = true;
      void restoreTokenState(controller.signal)
        .then(async (tokenState) => {
          if (!active) return;
          const destination = welcome === 'true' ? null : await getPendingRollpeDestination();
          if (!active) return;
          if (tokenState) finishSignIn(destination);
          else if (destination) router.replace(destination);
          else {
            // Returning by swipe/system back cancels the invite just like the visible back button.
            if (welcome === 'true') void clearPendingRollpeDestination();
            setStatus('welcome');
          }
        })
        .catch(() => {
          if (active) setStatus('error');
        });
      return () => {
        active = false;
        controller.abort();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Retrying intentionally restarts the focused check.
    }, [attempt, router, finishSignIn, welcome]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
      <View
        style={styles.screen}
        pointerEvents={status === 'welcome' ? 'auto' : 'none'}
        aria-hidden={status !== 'welcome'}
        accessibilityElementsHidden={status !== 'welcome'}
        importantForAccessibility={status === 'welcome' ? 'auto' : 'no-hide-descendants'}
      >
        <WelcomeScreen />
      </View>
      {status === 'checking' && <LoadingView accessibilityLabel={t('auth.checking')} />}
      {status === 'error' && (
        <AppDialog
          message={t('auth.startupFailed')}
          confirmLabel={t('common.retry')}
          onConfirm={() => {
            setStatus('checking');
            setAttempt((value) => value + 1);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
