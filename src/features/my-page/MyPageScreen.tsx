import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppFooter } from '@/components/AppFooter';
import { AppSideMenu } from '@/components/AppSideMenu';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { AppDialog } from '@/components/ui/AppDialog';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { fetchHomeStatus, type HomeStatus } from '@/features/home/api';
import { myRollpeTitles, type MyRollpeKind } from '@/features/my-page/api';
import { changeAccount } from '@/features/my-page/account-api';
import { getTokenState, type TokenState } from '@/features/sign-in/token-state';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export default function MyPageScreen() {
  const { t } = useTranslation(),
    colors = useRollpeColors(),
    safeArea = useSafeAreaSpacing(),
    router = useRouter();
  const { openWelcome, openSignIn } = useAppNavigation();
  const [result, setResult] = useState<{ user: TokenState['user']; status?: HomeStatus } | null>(
    null,
  );
  const [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0),
    [menu, setMenu] = useState(false);
  const [action, setAction] = useState<'logout' | 'withdraw' | null>(null),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; exit?: boolean } | null>(null);
  const operation = useRef<AbortController | null>(null),
    pending = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (attempt > 0) setError('');
      setAction(null);
      setBusy(false);
      const controller = new AbortController();
      void (async () => {
        try {
          const token = await getTokenState();
          if (!token) throw new AuthenticationRequiredError();
          if (controller.signal.aborted) return;
          setResult((current) => ({
            user: token.user,
            status: current?.user.id === token.user.id ? current.status : undefined,
          }));
          setError('');
          const status = await fetchHomeStatus(controller.signal);
          if (!controller.signal.aborted) setResult({ user: token.user, status });
        } catch (cause) {
          if (controller.signal.aborted) return;
          if (cause instanceof AuthenticationRequiredError) openWelcome();
          else setError(t('myPage.statusFailed'));
        }
      })();
      return () => {
        controller.abort();
        operation.current?.abort();
        pending.current = false;
      };
    }, [attempt, openWelcome, t]),
  );

  async function confirmAction() {
    if (!action || pending.current) return;
    pending.current = true;
    setBusy(true);
    const controller = new AbortController();
    operation.current = controller;
    try {
      const message = await changeAccount(action, undefined, controller.signal);
      if (!controller.signal.aborted) {
        setAction(null);
        setNotice({ message, exit: true });
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      setAction(null);
      if (cause instanceof AuthenticationRequiredError) openSignIn();
      else setNotice({ message: cause instanceof Error ? cause.message : t('account.uncertain') });
    } finally {
      if (!controller.signal.aborted) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  const loading = !result && !error;
  const failure = (
    <View style={styles.failure}>
      <Text accessibilityRole="alert" style={[styles.message, { color: colors.rollpe_main }]}>
        {error}
      </Text>
      <PrimaryButton title={t('common.retry')} onPress={() => setAttempt((value) => value + 1)} />
    </View>
  );
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') },
      ]}
    >
      <ScrollView
        pointerEvents={loading || busy ? 'none' : 'auto'}
        aria-hidden={loading || busy}
        accessibilityElementsHidden={loading || busy}
        importantForAccessibility={loading || busy ? 'no-hide-descendants' : 'auto'}
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={styles.contents}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>
          {t('home.myPage')}
        </Text>
        <View style={styles.profile}>
          <View style={styles.nicknameRow}>
            <Text style={[styles.nickname, { color: colors.rollpe_secondary }]}>
              {result ? t('myPage.nickname', { name: result.user.name }) : '\u00a0'}
            </Text>
            {result?.user.provider && <SocialBadge provider={result.user.provider} />}
          </View>
          <Text style={[styles.identify, { color: colors.rollpe_secondary }]}>
            {result?.user.identifyCode ?? ''}
          </Text>
          <Text style={[styles.count, { color: colors.rollpe_secondary }]}>
            {t('home.hostCount', { count: result?.status?.host ?? '—' })}
          </Text>
          <Text style={[styles.count, styles.heartCount, { color: colors.rollpe_secondary }]}>
            {t('home.heartCount', { count: result?.status?.heart ?? '—' })}
          </Text>
          {error ? failure : null}
        </View>
        <View
          style={styles.menus}
          pointerEvents={result ? 'auto' : 'none'}
          aria-hidden={!result}
          accessibilityElementsHidden={!result}
          importantForAccessibility={result ? 'auto' : 'no-hide-descendants'}
        >
          {result && !result.user.provider && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/change-password')}
              style={({ pressed }) => pressed && styles.pressed}
              hitSlop={8}
            >
              <Text style={[styles.menuLabel, { color: colors.rollpe_secondary }]}>
                {t('account.changePassword')}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/invitations')}
            style={({ pressed }) => pressed && styles.pressed}
            hitSlop={8}
          >
            <Text style={[styles.menuLabel, { color: colors.rollpe_secondary }]}>
              {t('myPage.invitations')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/blocked-users')}
            style={({ pressed }) => pressed && styles.pressed}
            hitSlop={8}
          >
            <Text style={[styles.menuLabel, { color: colors.rollpe_secondary }]}>
              {t('blocking.title')}
            </Text>
          </Pressable>
          {(['created', 'participating', 'received'] as MyRollpeKind[]).map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() =>
                router.navigate({ pathname: '/my-page/rollpes/[kind]', params: { kind } })
              }
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.menuLabel, { color: colors.rollpe_secondary }]}>
                {t(myRollpeTitles[kind])}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAction('logout')}
            style={({ pressed }) => pressed && styles.pressed}
            hitSlop={8}
          >
            <Text style={[styles.menuLabel, { color: colors.rollpe_secondary }]}>
              {t('account.logout')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAction('withdraw')}
            style={({ pressed }) => pressed && styles.pressed}
            hitSlop={8}
          >
            <Text style={[styles.menuLabel, { color: colors.rollpe_gray }]}>
              {t('account.withdraw')}
            </Text>
          </Pressable>
        </View>
        <View style={styles.spacer} />
        <AppFooter />
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.menuOpen')}
        accessibilityState={{ expanded: menu }}
        disabled={!result || busy}
        hitSlop={8}
        onPress={() => setMenu(true)}
        style={[
          styles.menuButton,
          { top: safeArea('top', 20), backgroundColor: colors.rollpe_primary },
        ]}
      >
        <Image
          source={require('@/assets/images/home/menu.svg')}
          accessible={false}
          contentFit="contain"
          style={styles.menuIcon}
        />
      </Pressable>
      {loading && <LoadingView accessibilityLabel={t('myPage.loading')} />}
      {menu && <AppSideMenu current="myPage" onClose={() => setMenu(false)} />}
      {action && (
        <AppDialog
          title={t('account.warning')}
          busy={busy}
          message={t(action === 'logout' ? 'account.confirmLogout' : 'account.confirmWithdraw')}
          onCancel={() => setAction(null)}
          onConfirm={() => {
            void confirmAction();
          }}
        />
      )}
      {notice && (
        <AppDialog
          message={notice.message}
          onConfirm={() => {
            const exit = notice.exit;
            setNotice(null);
            if (exit) openSignIn();
          }}
        />
      )}
    </View>
  );
}

function SocialBadge({ provider }: { provider: string }) {
  const { t } = useTranslation(),
    colors = useRollpeColors();
  const badges = {
    kakao: {
      source: require('@/assets/icons/icon_kakao.svg'),
      background: colors.kakao,
      label: t('myPage.kakao'),
    },
    google: {
      source: require('@/assets/icons/icon_google.svg'),
      background: colors.rollpe_white,
      label: t('myPage.google'),
    },
    apple: {
      source: require('@/assets/icons/icon_apple.svg'),
      background: colors.real_black,
      label: t('myPage.apple'),
    },
  };
  if (provider !== 'kakao' && provider !== 'google' && provider !== 'apple') return null;
  const badge = badges[provider];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badge.background },
        provider === 'google' && { borderWidth: 1, borderColor: colors.real_black },
      ]}
    >
      <Image
        source={badge.source}
        contentFit="contain"
        accessible
        accessibilityLabel={badge.label}
        style={styles.socialIcon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  contents: { flexGrow: 1 },
  title: { marginTop: 76, fontFamily: RollpeFonts.display, fontSize: 32, textAlign: 'center' },
  profile: { marginTop: 52, marginHorizontal: 20 },
  nicknameRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nickname: { flexShrink: 1, fontFamily: RollpeFonts.display, fontSize: 24 },
  identify: { marginTop: 4, fontFamily: RollpeFonts.display, fontSize: 14 },
  count: { marginTop: 12, fontFamily: RollpeFonts.display, fontSize: 16 },
  heartCount: { marginTop: 4 },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: { width: 8, height: 8 },
  menus: { marginTop: 48, marginHorizontal: 20, gap: 16 },
  menuLabel: { fontFamily: RollpeFonts.display, fontSize: 20 },
  pressed: { opacity: 0.7 },
  spacer: { flexGrow: 1, minHeight: 40 },
  failure: { gap: 16, marginTop: 20 },
  message: { fontFamily: RollpeFonts.display, fontSize: 16, textAlign: 'center' },
  menuButton: {
    position: 'absolute',
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { width: 16, height: 14 },
});
