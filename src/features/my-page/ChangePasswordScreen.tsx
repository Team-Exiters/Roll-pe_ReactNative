import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppSideMenu } from '@/components/AppSideMenu';
import { AppDialog } from '@/components/ui/AppDialog';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { changeAccount } from '@/features/my-page/account-api';
import { isRecoveryPassword } from '@/features/password-recovery/validation';
import { getTokenState } from '@/features/sign-in/token-state';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export default function ChangePasswordScreen() {
  const { t } = useTranslation(), colors = useRollpeColors(), safeArea = useSafeAreaSpacing(), router = useRouter();
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<{ message: string; destination?: 'signIn' | 'back' } | null>(null);
  const nextField = useRef<ComponentRef<typeof TextInput>>(null), pending = useRef(false), request = useRef<AbortController | null>(null);

  function signIn() { router.dismissAll(); router.replace('/sign-in'); }
  function back() { if (router.canGoBack()) router.back(); else router.replace('/my-page'); }
  useFocusEffect(useCallback(() => {
    setBusy(false);
    let active = true;
    void getTokenState().then(token => {
      if (!active) return;
      if (!token) { router.replace('/sign-in'); return; }
      if (token.user.provider) { setReady(false); setNotice({ message: t('account.socialPassword'), destination: 'back' }); }
      else setReady(true);
    }).catch(() => { if (active) setNotice({ message: t('common.requestFailed'), destination: 'back' }); });
    return () => { active = false; request.current?.abort(); pending.current = false; };
  }, [router, t]));

  async function submit() {
    if (!ready || pending.current || !password || password !== confirmation) return;
    if (!isRecoveryPassword(password)) { setNotice({ message: t('validation.password') }); return; }
    pending.current = true; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const message = await changeAccount('changePassword', password, controller.signal);
      if (!controller.signal.aborted) { setPassword(''); setConfirmation(''); setReady(false); setNotice({ message, destination: 'signIn' }); }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) signIn();
      else setNotice({ message: cause instanceof Error ? cause.message : t('account.uncertain') });
    } finally { if (!controller.signal.aborted) { pending.current = false; setBusy(false); } }
  }

  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') }]}>
    <View style={styles.navigation}>
      <BackButton disabled={busy} style={styles.back} onPress={back} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.goHome')} disabled={busy} onPress={() => router.dismissTo('/home')}>
        <Image source={require('@/assets/images/welcome/logo.png')} contentFit="contain" accessible={false} style={styles.logo} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('home.menuOpen')} disabled={busy} onPress={() => setMenu(true)} hitSlop={8} style={styles.menuButton}>
        <Image source={require('@/assets/images/home/menu.svg')} contentFit="contain" accessible={false} style={styles.menuIcon} />
      </Pressable>
    </View>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={[styles.contents, { paddingBottom: safeArea('bottom', 40) }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{t('account.changePassword')}</Text>
        <View style={styles.form}>
          <RoundedBorderTextField accessibilityLabel={t('recovery.newPassword')} placeholder={t('recovery.newPassword')} value={password} onChangeText={setPassword}
            secureTextEntry textContentType="newPassword" autoComplete="new-password" maxLength={128} editable={ready && !busy}
            returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => nextField.current?.focus()} />
          <RoundedBorderTextField ref={nextField} accessibilityLabel={t('recovery.confirmPassword')} placeholder={t('recovery.confirmPassword')}
            value={confirmation} onChangeText={setConfirmation} secureTextEntry textContentType="newPassword" autoComplete="new-password" maxLength={128}
            editable={ready && !busy} returnKeyType="done" submitBehavior="blurAndSubmit" style={styles.confirmation} onSubmitEditing={() => { void submit(); }} />
          <PrimaryButton title={t('recovery.submit')} disabled={!ready || busy || !password || password !== confirmation}
            style={styles.submit} onPress={() => { void submit(); }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    {menu && <AppSideMenu current="myPage" onClose={() => setMenu(false)} />}
    {notice && <AppDialog message={notice.message} onConfirm={() => {
      const destination = notice.destination; setNotice(null);
      if (destination === 'signIn') signIn(); else if (destination === 'back') back();
    }} />}
    {busy && <LoadingView accessibilityLabel={t('common.processing')} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, navigation: { height: 68, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 0, top: 23.5 }, logo: { width: 48, height: 24 },
  menuButton: { position: 'absolute', right: 0, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, menuIcon: { width: 16, height: 14 },
  contents: { paddingTop: 8, paddingHorizontal: 20 }, title: { fontFamily: RollpeFonts.display, fontSize: 32, textAlign: 'center' },
  form: { marginTop: 52 }, confirmation: { marginTop: 8 }, submit: { marginTop: 32 },
});
