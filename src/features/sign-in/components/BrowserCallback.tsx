import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { AppDialog } from '@/components/ui/AppDialog';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
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
      {!error && <ActivityIndicator color={colors.rollpe_main} />}
      <Text style={[styles.message, { color: colors.rollpe_secondary }]}>
        {error ? t('auth.callbackFailed') : t('auth.callbackChecking')}
      </Text>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 },
  message: { fontFamily: RollpeFonts.regular, fontSize: 16, textAlign: 'center' },
});
