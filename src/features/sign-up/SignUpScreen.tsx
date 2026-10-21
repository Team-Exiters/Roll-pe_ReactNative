import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { signUp } from './api';
import { AgreementRow } from './components/AgreementRow';
import { canSignUp, type SignUpValues } from './validation';

const initialValues: SignUpValues = {
  email: '', name: '', password: '', confirmPassword: '',
  ageChecked: false, termsChecked: false, privacyChecked: false,
};

export default function SignUpScreen() {
  const colors = useRollpeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmationInput = useRef<ComponentRef<typeof TextInput>>(null);
  const [values, setValues] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  function change<K extends keyof SignUpValues>(key: K, value: SignUpValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/sign-in');
  }

  function showMessage(title: string, message: string, onConfirm?: () => void) {
    if (Platform.OS === 'web') {
      window.alert(message);
      onConfirm?.();
    } else {
      Alert.alert(title, message, [{ text: '확인', onPress: onConfirm }]);
    }
  }

  async function submit() {
    if (pending.current || !canSignUp(values)) return;
    pending.current = true;
    setLoading(true);
    try {
      const message = await signUp(values);
      if (active.current) {
        setValues(initialValues);
        showMessage('알림', message, () => { if (active.current) goBack(); });
      }
    } catch (error) {
      if (active.current) showMessage('오류', error instanceof Error ? error.message : '회원가입에 실패했습니다. 다시 시도해주세요.');
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false} bounces={false}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom }]}>
          <Image source={require('@/assets/images/welcome/logo.png')} contentFit="contain"
            accessibilityLabel="롤페" accessible style={styles.logo} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>회원가입</Text>
          <View style={styles.form}>
            <RoundedBorderTextField accessibilityLabel="이메일" placeholder="이메일" value={values.email}
              onChangeText={(value) => change('email', value)} editable={!loading} keyboardType="email-address"
              autoComplete="email" textContentType="emailAddress" returnKeyType="next" submitBehavior="submit"
              onSubmitEditing={() => nameInput.current?.focus()} />
            <RoundedBorderTextField ref={nameInput} accessibilityLabel="닉네임(2-6자)" placeholder="닉네임(2-6자)"
              value={values.name} onChangeText={(value) => change('name', value)} editable={!loading} maxLength={6}
              autoComplete="nickname" textContentType="nickname" returnKeyType="next" submitBehavior="submit"
              onSubmitEditing={() => passwordInput.current?.focus()} style={styles.nextField} />
            <RoundedBorderTextField ref={passwordInput} accessibilityLabel="비밀번호" placeholder="비밀번호"
              value={values.password} onChangeText={(value) => change('password', value)} editable={!loading}
              secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="next"
              submitBehavior="submit" onSubmitEditing={() => confirmationInput.current?.focus()} style={styles.nextField} />
            <RoundedBorderTextField ref={confirmationInput} accessibilityLabel="비밀번호 확인" placeholder="비밀번호 확인"
              value={values.confirmPassword} onChangeText={(value) => change('confirmPassword', value)} editable={!loading}
              secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="done"
              submitBehavior="blurAndSubmit" onSubmitEditing={() => { void submit(); }} style={styles.nextField} />
            <View style={styles.agreements}>
              <AgreementRow label="저는 만 14세 이상입니다." checked={values.ageChecked}
                onCheckedChange={(value) => change('ageChecked', value)} disabled={loading} />
              <AgreementRow label="서비스 이용약관에 동의합니다." checked={values.termsChecked} policy="terms"
                onCheckedChange={(value) => change('termsChecked', value)} disabled={loading} />
              <AgreementRow label="개인정보 수집 및 이용에 동의합니다." checked={values.privacyChecked} policy="privacy"
                onCheckedChange={(value) => change('privacyChecked', value)} disabled={loading} />
            </View>
            <PrimaryButton title="가입" disabled={loading || !canSignUp(values)} style={styles.submit}
              onPress={() => { void submit(); }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <BackButton disabled={loading} style={[styles.back, { top: insets.top + 20 }]} onPress={goBack} />
      {loading && <LoadingView accessibilityLabel="회원가입 중" />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  logo: { width: '37.7884615%', aspectRatio: 2 },
  title: { fontFamily: RollpeFonts.regular, fontSize: 20, marginTop: 20 },
  form: { width: '100%', marginTop: 60 },
  nextField: { marginTop: 8 },
  agreements: { marginTop: 40, gap: 8 },
  submit: { marginTop: 20 },
  back: { position: 'absolute', left: 20 },
});
