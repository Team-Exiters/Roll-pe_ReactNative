import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { requestPasswordEmail } from '@/features/password-recovery/api';
import { RecoveryScaffold, recoveryMessage } from '@/features/password-recovery/RecoveryScaffold';
import { isRecoveryEmail } from '@/features/password-recovery/validation';

export default function ForgotPasswordScreen() {
  const colors = useRollpeColors();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function submit() {
    if (pending.current || !isRecoveryEmail(email)) return;
    pending.current = true;
    setLoading(true);
    try {
      const message = await requestPasswordEmail(email);
      if (active.current) recoveryMessage('알림', message, () => router.replace('/sign-in'));
    } catch (error) {
      if (active.current) recoveryMessage('오류', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }

  return (
    <RecoveryScaffold loading={loading}>
      <Image source={require('@/assets/images/welcome/logo.png')} contentFit="contain"
        accessibilityLabel="롤페" accessible style={styles.logo} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>비밀번호 찾기</Text>
      <View style={styles.form}>
        <RoundedBorderTextField accessibilityLabel="이메일" placeholder="이메일" value={email}
          onChangeText={setEmail} maxLength={254} editable={!loading} keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" returnKeyType="send"
          submitBehavior="blurAndSubmit" onSubmitEditing={() => { void submit(); }} />
        <PrimaryButton title="이메일 인증" disabled={loading || !isRecoveryEmail(email)}
          onPress={() => { void submit(); }} style={styles.submit} />
      </View>
    </RecoveryScaffold>
  );
}

const styles = StyleSheet.create({
  logo: { width: '37.7884615%', aspectRatio: 2 },
  title: { fontFamily: RollpeFonts.regular, fontSize: 20, marginTop: 20 },
  form: { width: '100%', marginTop: 60 },
  submit: { marginTop: 24 },
});
