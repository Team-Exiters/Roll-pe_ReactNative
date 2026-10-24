import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { SignInForm } from '@/features/sign-in/components/SignInForm';
import { SocialSignInButton } from '@/features/sign-in/components/SocialSignInButton';
import { useSignIn } from '@/features/sign-in/useSignIn';
import { rollpeDestination } from '@/utils/rollpe-link';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';

export default function SignInScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const safeArea = useSafeAreaSpacing();
  const signIn = useSignIn();

  function showSignInMessage(message: string) {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert(t('common.error'), message, [{ text: t('common.confirm') }]);
    }
  }

  async function submitSignIn(action: () => ReturnType<typeof signIn.emailSignIn>) {
    try {
      const tokenState = await action();
      if (tokenState) {
        router.dismissAll();
        router.replace(rollpeDestination(returnTo) ?? '/home');
      }
    } catch (error) {
      showSignInMessage(error instanceof Error ? error.message : t('auth.failed'));
    }
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingBottom: safeArea('bottom') }]}>
      <Image
        source={require('@/assets/images/welcome/background.jpg')}
        contentFit="cover"
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.screen, { paddingTop: safeArea('top') }]}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <Image
            accessibilityLabel={t('common.brand')}
            accessible
            source={require('@/assets/images/welcome/logo.png')}
            contentFit="contain"
            style={styles.logo}
          />
          <Text numberOfLines={2} style={[styles.title, { color: colors.rollpe_secondary }]}>
            {t('welcome.tagline')}
          </Text>
          <SignInForm
            disabled={signIn.isLoading}
            onSubmit={signIn.canSignIn
              ? (credentials) => { void submitSignIn(() => signIn.emailSignIn(credentials)); }
              : undefined}
          />
          <View style={styles.menus}>
            <Pressable accessibilityRole="link" accessibilityLabel={t('common.forgotPassword')}
              disabled={signIn.isLoading} hitSlop={12} onPress={() => router.push('/forgot-password')}>
              <Text style={[styles.menuText, { color: colors.rollpe_gray }]}>{t('common.forgotPassword')}</Text>
            </Pressable>
            <Text accessible={false} style={[styles.menuText, { color: colors.rollpe_gray }]}>|</Text>
            <Pressable
              accessibilityRole="link"
              disabled={signIn.isLoading}
              hitSlop={12}
              onPress={() => router.push('/sign-up')}>
              <Text style={[styles.menuText, { color: colors.rollpe_gray }]}>{t('common.signUp')}</Text>
            </Pressable>
          </View>
          <View style={styles.socials}>
            {(['kakao', 'google', 'apple'] as const).map((provider) => (
              <SocialSignInButton
                key={provider}
                provider={provider}
                disabled={signIn.isLoading}
                onPress={signIn.canUseProvider(provider)
                  ? () => { void submitSignIn(() => signIn.socialSignIn(provider)); }
                  : undefined}
              />
            ))}
          </View>
          <View style={styles.policies}>
            <Pressable
              accessibilityRole="link"
              disabled={signIn.isLoading}
              onPress={() => router.push({ pathname: '/policy', params: { type: 'terms' } })}>
              <Text style={[styles.policyText, { color: colors.rollpe_gray }]}>{t('common.terms')}</Text>
            </Pressable>
            <Text style={[styles.policyText, { color: colors.rollpe_gray }]}>|</Text>
            <Pressable
              accessibilityRole="link"
              disabled={signIn.isLoading}
              onPress={() => router.push({ pathname: '/policy', params: { type: 'privacy' } })}>
              <Text style={[styles.policyText, { color: colors.rollpe_gray }]}>{t('common.privacy')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <BackButton onPress={goBack} style={[styles.back, { top: safeArea('top', 20) }]} />
      {signIn.isLoading && <LoadingView />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  logo: {
    width: '42.7%',
    aspectRatio: 2,
  },
  title: {
    fontFamily: RollpeFonts.display,
    fontSize: 20,
    lineHeight: 20 * 1.02 * 0.98,
    textAlign: 'center',
    marginTop: 20,
  },
  menus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  menuText: {
    fontFamily: RollpeFonts.display,
    fontSize: 14,
  },
  socials: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  policies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 64,
  },
  policyText: {
    fontFamily: RollpeFonts.regular,
    fontSize: 12,
  },
  back: {
    position: 'absolute',
    left: 20,
  },
});
