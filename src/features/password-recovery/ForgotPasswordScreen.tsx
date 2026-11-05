import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { requestPasswordEmail } from '@/features/password-recovery/api';
import { RecoveryScaffold, recoveryMessage } from '@/features/password-recovery/RecoveryScaffold';
import { isRecoveryEmail } from '@/features/password-recovery/validation';
import { useAppNavigation } from '@/hooks/useAppNavigation';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const { openSignIn } = useAppNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function submit() {
    if (pending.current || !isRecoveryEmail(email)) return;
    pending.current = true;
    setLoading(true);
    try {
      const message = await requestPasswordEmail(email);
      if (active.current)
        recoveryMessage(t('common.notice'), message, () => {
          if (active.current) openSignIn();
        });
    } catch (error) {
      if (active.current)
        recoveryMessage(
          t('common.error'),
          error instanceof Error ? error.message : t('common.retryMessage'),
        );
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }

  return (
    <RecoveryScaffold loading={loading}>
      <Image
        source={require('@/assets/images/welcome/logo.png')}
        contentFit="contain"
        accessibilityLabel={t('common.brand')}
        accessible
        style={styles.logo}
      />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>
        {t('common.forgotPassword')}
      </Text>
      <View style={styles.form}>
        <RoundedBorderTextField
          accessibilityLabel={t('common.email')}
          placeholder={t('common.email')}
          value={email}
          onChangeText={setEmail}
          maxLength={254}
          editable={!loading}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => {
            void submit();
          }}
        />
        <PrimaryButton
          title={t('recovery.verifyEmail')}
          disabled={loading || !isRecoveryEmail(email)}
          onPress={() => {
            void submit();
          }}
          style={styles.submit}
        />
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
