import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';

import { useTranslation } from '@/i18n';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { resetCredentials, type ResetCredentials } from '@/utils/reset-link';
import { PasswordRecoveryError, resetPassword } from '@/features/password-recovery/api';
import { RecoveryScaffold, recoveryMessage } from '@/features/password-recovery/RecoveryScaffold';
import { isRecoveryPassword } from '@/features/password-recovery/validation';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ identifyCode?: string | string[]; token?: string | string[] }>();
  const credentials = resetCredentials(params);
  // A different link remounts the form, clearing inputs and isolating pending responses.
  return <ResetPasswordForm key={credentials ? `${credentials.identifyCode}:${credentials.token}` : 'invalid'} credentials={credentials} />;
}

function ResetPasswordForm({ credentials }: { credentials: ResetCredentials | null }) {
  const { t } = useTranslation();
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
      recoveryMessage(t('common.error'), t('validation.password'));
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
        recoveryMessage(t('common.notice'), message);
      }
    } catch (error) {
      if (active.current) {
        if (error instanceof PasswordRecoveryError && error.invalidLink) {
          setExpired(true); setPassword(''); setConfirmPassword('');
        }
        recoveryMessage(t('common.error'), error instanceof Error ? error.message : t('common.retryMessage'));
      }
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }

  const invalidLink = !credentials || expired;
  return (
    <RecoveryScaffold loading={loading} reset>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{t('common.resetPassword')}</Text>
      <View style={styles.form}>
        {invalidLink ? <>
          <Text accessibilityRole="alert" style={[styles.explanation, { color: colors.rollpe_secondary }]}>
            {t('recovery.invalidLink')}</Text>
          <PrimaryButton title={t('recovery.newEmail')} style={styles.retry}
            onPress={() => router.replace('/forgot-password')} />
        </> : <>
          <RoundedBorderTextField accessibilityLabel={t('recovery.newPassword')} placeholder={t('recovery.newPassword')} value={password}
            onChangeText={setPassword} maxLength={128} editable={!loading} secureTextEntry
            textContentType="newPassword" autoComplete="new-password" returnKeyType="next"
            submitBehavior="submit" onSubmitEditing={() => confirmation.current?.focus()} />
          <RoundedBorderTextField ref={confirmation} accessibilityLabel={t('recovery.confirmPassword')} placeholder={t('recovery.confirmPassword')}
            value={confirmPassword} onChangeText={setConfirmPassword} maxLength={128} editable={!loading}
            secureTextEntry textContentType="newPassword" autoComplete="new-password" returnKeyType="done"
            submitBehavior="blurAndSubmit" onSubmitEditing={() => { void submit(); }} style={styles.confirm} />
          <PrimaryButton title={t('recovery.submit')} disabled={loading || !password || password !== confirmPassword}
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
