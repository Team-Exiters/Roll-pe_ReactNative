import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import WelcomeScreen from '@/features/welcome/WelcomeScreen';
import { restoreTokenState } from '@/lib/authenticated-api';
import { getPendingRollpeDestination } from '@/features/sign-in/pending-rollpe';

export default function StartupGate() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'checking' | 'welcome' | 'error'>('checking');

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      let active = true;
      setStatus('checking');
      void restoreTokenState(controller.signal)
        .then(async (tokenState) => {
          if (!active) return;
          const destination = await getPendingRollpeDestination();
          if (!active) return;
          if (destination) router.replace(destination);
          else if (tokenState) router.replace('/home');
          else setStatus('welcome');
        })
        .catch(() => {
          if (active) setStatus('error');
        });
      return () => {
        active = false;
        controller.abort();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Retrying intentionally restarts the focused check.
    }, [attempt, router]),
  );

  if (status === 'welcome') return <WelcomeScreen />;
  return (
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
      {status === 'checking' ? (
        <LoadingView accessibilityLabel={t('auth.checking')} />
      ) : (
        <View style={styles.error}>
          <Text
            accessibilityRole="alert"
            style={[styles.message, { color: colors.rollpe_secondary }]}
          >
            {t('auth.startupFailed')}
          </Text>
          <PrimaryButton
            title={t('common.retry')}
            onPress={() => setAttempt((value) => value + 1)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  error: { padding: 24, gap: 24 },
  message: { fontFamily: RollpeFonts.regular, fontSize: 16, textAlign: 'center' },
});
