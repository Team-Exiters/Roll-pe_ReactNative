import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { t, useTranslation } from '@/i18n';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { useRollpeColors } from '@/constants/theme';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useAppNavigation } from '@/hooks/useAppNavigation';

export function recoveryMessage(title: string, message: string, onConfirm?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(message);
    onConfirm?.();
  } else {
    Alert.alert(title, message, [{ text: t('common.confirm'), onPress: onConfirm }]);
  }
}

export function RecoveryScaffold({
  children,
  loading,
  reset = false,
}: {
  children: ReactNode;
  loading: boolean;
  reset?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const safeArea = useSafeAreaSpacing();
  const router = useRouter();
  const { openSignIn } = useAppNavigation();
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.rollpe_primary, paddingBottom: safeArea('bottom') },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: reset ? safeArea('top', 48, 76) : safeArea('top', 80),
              paddingBottom: 40,
            },
          ]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      <BackButton
        disabled={loading}
        style={[styles.back, { top: safeArea('top', 20) }]}
        onPress={() => (router.canGoBack() ? router.back() : openSignIn())}
      />
      {loading && <LoadingView accessibilityLabel={t('common.processing')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  back: { position: 'absolute', left: 20 },
});
