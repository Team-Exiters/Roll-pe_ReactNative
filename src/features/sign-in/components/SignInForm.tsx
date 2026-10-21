import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';

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
        accessibilityLabel="이메일"
        placeholder="이메일"
        value={email}
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
        accessibilityLabel="비밀번호"
        placeholder="비밀번호"
        value={password}
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
          accessibilityLabel="로그인 유지"
          checked={keepSignIn}
          onCheckedChange={setKeepSignIn}
          disabled={disabled}
        />
        <Text style={[styles.keepSignInText, { color: colors.rollpe_gray }]}>로그인 유지</Text>
      </View>
      <PrimaryButton
        title="로그인"
        disabled={!canSubmit}
        onPress={submit}
        accessibilityHint={!onSubmit ? '현재 사용할 수 없습니다.' : undefined}
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
