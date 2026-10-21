import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { PasswordRecoveryError, resetPassword } from './api';
import { RecoveryScaffold, recoveryMessage } from './RecoveryScaffold';
import { isRecoveryPassword, passwordPolicyMessage, resetCredentials, type ResetCredentials } from './validation';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ identifyCode?: string | string[]; token?: string | string[] }>();
  const credentials = resetCredentials(params);
  // A different link remounts the form, clearing inputs and isolating pending responses.
  return <ResetPasswordForm key={credentials ? `${credentials.identifyCode}:${credentials.token}` : 'invalid'} credentials={credentials} />;
}

function ResetPasswordForm({ credentials }: { credentials: ResetCredentials | null }) {
  const router = useRouter();
  const colors = useRollpeColors();
  const confirmation = useRef<ComponentRef<typeof TextInput>>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function submit() {
    if (pending.current || !credentials || expired || !password || password !== confirmPassword) return;
    if (!isRecoveryPassword(password)) {
      recoveryMessage('오류', passwordPolicyMessage);
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const message = await resetPassword(credentials, password);
      if (active.current) {
        setPassword(''); setConfirmPassword('');
        // Remove the used secret from navigation immediately, before presenting success.
        router.replace('/sign-in');
        recoveryMessage('알림', message);
      }
    } catch (error) {
      if (active.current) {
        if (error instanceof PasswordRecoveryError && error.invalidLink) {
          setExpired(true); setPassword(''); setConfirmPassword('');
        }
        recoveryMessage('오류', error instanceof Error ? error.message : '다시 시도해주세요.');
      }
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }

  const invalidLink = !credentials || expired;
  return (
    <RecoveryScaffold loading={loading} reset>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>비밀번호 변경</Text>
      <View style={styles.form}>
        {invalidLink ? <>
          <Text accessibilityRole="alert" style={[styles.explanation, { color: colors.rollpe_secondary }]}>
            인증 링크가 올바르지 않거나 만료되었습니다. 새 인증 메일을 요청해주세요.
          </Text>
          <PrimaryButton title="새 인증 메일 요청" style={styles.retry}
            onPress={() => router.replace('/forgot-password')} />
        </> : <>
          <RoundedBorderTextField accessibilityLabel="새 비밀번호" placeholder="새 비밀번호" value={password}
            onChangeText={setPassword} maxLength={128} editable={!loading} secureTextEntry
            textContentType="newPassword" autoComplete="new-password" returnKeyType="next"
            submitBehavior="submit" onSubmitEditing={() => confirmation.current?.focus()} />
          <RoundedBorderTextField ref={confirmation} accessibilityLabel="새 비밀번호 확인" placeholder="새 비밀번호 확인"
            value={confirmPassword} onChangeText={setConfirmPassword} maxLength={128} editable={!loading}
            secureTextEntry textContentType="newPassword" autoComplete="new-password" returnKeyType="done"
            submitBehavior="blurAndSubmit" onSubmitEditing={() => { void submit(); }} style={styles.confirm} />
          <PrimaryButton title="변경하기" disabled={loading || !password || password !== confirmPassword}
            onPress={() => { void submit(); }} style={styles.submit} />
        </>}
      </View>
    </RecoveryScaffold>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: RollpeFonts.display, fontSize: 32, textAlign: 'center' },
  form: { width: '100%', marginTop: 52 },
  confirm: { marginTop: 8 },
  submit: { marginTop: 32 },
  explanation: { fontFamily: RollpeFonts.regular, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  retry: { marginTop: 32 },
});
