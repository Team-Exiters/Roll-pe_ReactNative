import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { SignInForm } from '@/features/sign-in/components/SignInForm';
import { SocialSignInButton } from '@/features/sign-in/components/SocialSignInButton';
import { useSignIn } from '@/features/sign-in/useSignIn';

export default function SignInScreen() {
  const colors = useRollpeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signIn = useSignIn();

  function showSignInMessage(message: string) {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('로그인', message);
    }
  }

  async function submitSignIn(action: () => ReturnType<typeof signIn.emailSignIn>) {
    try {
      const session = await action();
      if (session) {
        // The authenticated home screen will be connected when its migration is complete.
        showSignInMessage('로그인되었습니다.');
      }
    } catch (error) {
      showSignInMessage(error instanceof Error ? error.message : '로그인에 실패했습니다. 다시 시도해주세요.');
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
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
      <Image
        source={require('@/assets/images/welcome/background.jpg')}
        contentFit="cover"
        accessible={false}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.screen, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <Image
            accessibilityLabel="롤페"
            accessible
            source={require('@/assets/images/welcome/logo.png')}
            contentFit="contain"
            style={styles.logo}
          />
          <Text numberOfLines={2} style={[styles.title, { color: colors.rollpe_secondary }]}>
            {'다같이 한 마음으로\n사랑하는 사람에게 전달해보세요'}
          </Text>
          <SignInForm
            disabled={signIn.isLoading}
            onSubmit={signIn.canSignIn
              ? (credentials) => { void submitSignIn(() => signIn.emailSignIn(credentials)); }
              : undefined}
          />
          <View style={styles.menus}>
            <Pressable accessibilityRole="link" accessibilityLabel="비밀번호 찾기"
              disabled={signIn.isLoading} hitSlop={12} onPress={() => router.push('/forgot-password')}>
              <Text style={[styles.menuText, { color: colors.rollpe_gray }]}>비밀번호 찾기</Text>
            </Pressable>
            <Text accessible={false} style={[styles.menuText, { color: colors.rollpe_gray }]}>|</Text>
            <Pressable
              accessibilityRole="link"
              disabled={signIn.isLoading}
              hitSlop={12}
              onPress={() => router.push('/sign-up')}>
              <Text style={[styles.menuText, { color: colors.rollpe_gray }]}>회원가입</Text>
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
              <Text style={[styles.policyText, { color: colors.rollpe_gray }]}>서비스 이용약관</Text>
            </Pressable>
            <Text style={[styles.policyText, { color: colors.rollpe_gray }]}>|</Text>
            <Pressable
              accessibilityRole="link"
              disabled={signIn.isLoading}
              onPress={() => router.push({ pathname: '/policy', params: { type: 'privacy' } })}>
              <Text style={[styles.policyText, { color: colors.rollpe_gray }]}>개인정보처리방침</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <BackButton onPress={goBack} style={[styles.back, { top: insets.top + 20 }]} />
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
