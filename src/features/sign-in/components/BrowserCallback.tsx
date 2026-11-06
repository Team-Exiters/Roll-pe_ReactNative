import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { AppDialog } from '@/components/ui/AppDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { useRollpeColors } from '@/constants/theme';
import WelcomeScreen from '@/features/welcome/WelcomeScreen';
import { completeWebBrowserSignIn } from '@/features/sign-in/browser-auth';
import { resolveRollpeDestination } from '@/features/sign-in/pending-rollpe';
import { useAppNavigation } from '@/hooks/useAppNavigation';

export default function BrowserCallback() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const { openSignIn, finishSignIn } = useAppNavigation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (Platform.OS === 'web') {
      // Defer consumption so React's development effect replay cannot exchange twice.
      Promise.resolve()
        .then(() => (active ? completeWebBrowserSignIn(controller.signal) : null))
        .then(async (result) => {
          if (!active) return;
          const next = result ? await resolveRollpeDestination() : null;
          if (!active) return;
          if (result) finishSignIn(next);
          else openSignIn();
        })
        .catch((failure: unknown) => {
          if (active)
            setError(failure instanceof Error ? failure.message : t('auth.callbackFailed'));
        });
    } else openSignIn();
    return () => {
      active = false;
      controller.abort();
    };
  }, [openSignIn, finishSignIn, t]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.rollpe_primary }]}>
      <View
        style={styles.container}
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <WelcomeScreen />
      </View>
      {!error && <LoadingView accessibilityLabel={t('auth.callbackChecking')} />}
      {error && (
        <AppDialog
          title={t('common.signIn')}
          message={error}
          onConfirm={() => openSignIn()}
          onClose={() => openSignIn()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
