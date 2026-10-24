import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';

import { useTranslation } from '@/i18n';
import { Checkbox } from '@/components/ui/Checkbox';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export type SignInCredentials = {
  email: string;
  password: string;
  keepSignIn: boolean;
};

type SignInFormProps = {
  onSubmit?: (credentials: SignInCredentials) => void;
  disabled?: boolean;
};

export function SignInForm({ onSubmit, disabled = false }: SignInFormProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignIn, setKeepSignIn] = useState(true);
  const canSubmit = email.trim().length > 0 && password.length > 0 && Boolean(onSubmit) && !disabled;

  function submit() {
    if (canSubmit) {
      onSubmit?.({ email, password, keepSignIn });
    }
  }

  return (
    <View style={styles.form}>
      <RoundedBorderTextField
        accessibilityLabel={t('common.email')}
        placeholder={t('common.email')}
        value={email}
        maxLength={254}
        onChangeText={setEmail}
        editable={!disabled}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordInput.current?.focus()}
      />
      <RoundedBorderTextField
        ref={passwordInput}
        accessibilityLabel={t('common.password')}
        placeholder={t('common.password')}
        value={password}
        maxLength={128}
        onChangeText={setPassword}
        editable={!disabled}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={submit}
        style={styles.password}
      />
      <View style={styles.keepSignIn}>
        <Checkbox
          accessibilityLabel={t('auth.keepSignIn')}
          checked={keepSignIn}
          onCheckedChange={setKeepSignIn}
          disabled={disabled}
        />
        <Text style={[styles.keepSignInText, { color: colors.rollpe_gray }]}>{t('auth.keepSignIn')}</Text>
      </View>
      <PrimaryButton
        title={t('common.signIn')}
        disabled={!canSubmit}
        onPress={submit}
        accessibilityHint={!onSubmit ? t('common.unavailable') : undefined}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
    marginTop: 60,
  },
  password: {
    marginTop: 12,
  },
  keepSignIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  keepSignInText: {
    fontFamily: RollpeFonts.display,
    fontSize: 14,
  },
  submit: {
    marginTop: 28,
  },
});
