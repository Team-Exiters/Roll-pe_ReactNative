import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import WelcomeScreen from '@/features/welcome/WelcomeScreen';
import { restoreTokenState } from '@/lib/authenticated-api';

export default function StartupGate() {
  const colors = useRollpeColors();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'checking' | 'welcome' | 'error'>('checking');

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setStatus('checking');
    void restoreTokenState(controller.signal).then(tokenState => {
      if (!active) return;
      if (tokenState) router.replace('/home');
      else setStatus('welcome');
    }).catch(() => {
      if (active) setStatus('error');
    });
    return () => { active = false; controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Retrying intentionally restarts the focused check.
  }, [attempt, router]));

  if (status === 'welcome') return <WelcomeScreen />;
  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
    {status === 'checking' ? <LoadingView accessibilityLabel="로그인 상태 확인 중" /> : <View style={styles.error}>
      <Text accessibilityRole="alert" style={[styles.message, { color: colors.rollpe_secondary }]}>
        로그인 상태를 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.
      </Text>
      <PrimaryButton title="다시 시도" onPress={() => setAttempt(value => value + 1)} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  error: { padding: 24, gap: 24 },
  message: { fontFamily: RollpeFonts.regular, fontSize: 16, textAlign: 'center' },
});
