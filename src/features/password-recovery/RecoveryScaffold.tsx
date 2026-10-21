import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { useRollpeColors } from '@/constants/theme';

export function recoveryMessage(title: string, message: string, onConfirm?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(message);
    onConfirm?.();
  } else {
    Alert.alert(title, message, [{ text: '확인', onPress: onConfirm }]);
  }
}

export function RecoveryScaffold({ children, loading, reset = false }: {
  children: ReactNode; loading: boolean; reset?: boolean;
}) {
  const colors = useRollpeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false} bounces={false}
          contentContainerStyle={[styles.content, {
            paddingTop: reset ? Math.max(76, insets.top + 48) : insets.top + 80,
            paddingBottom: insets.bottom + 40,
          }]}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      <BackButton disabled={loading} style={[styles.back, { top: insets.top + 20 }]}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/sign-in')} />
      {loading && <LoadingView accessibilityLabel="요청 처리 중" />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  back: { position: 'absolute', left: 20 },
});
