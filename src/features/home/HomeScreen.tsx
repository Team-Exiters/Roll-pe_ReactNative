import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { AppFooter } from '@/components/AppFooter';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { fetchHomeStatus, fetchHotRollpes, type HomeStatus, type HotRollpe } from '@/features/home/api';
import { HomeSideMenu } from '@/features/home/components/HomeSideMenu';
import { RollpeCard } from '@/features/home/components/RollpeCard';
import { getTokenState } from '@/features/sign-in/token-state';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

type HomeResult = {
  userName: string;
  status?: HomeStatus;
  rollpes?: HotRollpe[];
  statusError?: string;
  rollpesError?: string;
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const safeArea = useSafeAreaSpacing();
  const router = useRouter();
  const [result, setResult] = useState<HomeResult | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  useFocusEffect(useCallback(() => {
    if (attempt > 0) { setError(false); setResult(null); }
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const tokenState = await getTokenState();
        if (!active) return;
        if (!tokenState) { router.replace('/sign-in'); return; }
        const [status, rollpes] = await Promise.allSettled([
          fetchHomeStatus(controller.signal), fetchHotRollpes(controller.signal),
        ]);
        if (!active) return;
        if ([status, rollpes].some(value => value.status === 'rejected' && value.reason instanceof AuthenticationRequiredError)) {
          router.replace('/sign-in');
          return;
        }
        setResult({ userName: tokenState.user.name,
          status: status.status === 'fulfilled' ? status.value : undefined,
          statusError: status.status === 'rejected' ? t('home.statusFailed') : undefined,
          rollpes: rollpes.status === 'fulfilled' ? rollpes.value : undefined,
          rollpesError: rollpes.status === 'rejected' ? t('home.rollpesFailed') : undefined,
        });
      } catch {
        if (active) setError(true);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [attempt, router, t]));

  function retry() { setError(false); setResult(null); setAttempt(value => value + 1); }
  function unavailable() {
    if (Platform.OS === 'web') window.alert(t('common.comingSoon'));
    else Alert.alert(t('common.notice'), t('common.comingSoon'));
  }
  function failure(message: string) {
    return <View style={styles.failure}>
      <Text accessibilityRole="alert" style={[styles.error, { color: colors.rollpe_secondary }]}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={retry} hitSlop={12}>
        <Text style={[styles.error, { color: colors.rollpe_main }]}>{t('common.retry')}</Text>
      </Pressable>
    </View>;
  }
  if (!result) return <View style={[styles.loading, { backgroundColor: colors.rollpe_primary }]}>
    {error ? failure(t('home.failed')) : <ActivityIndicator accessibilityLabel={t('home.loading')} color={colors.rollpe_main} />}
  </View>;

  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') }]}>
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false} contentContainerStyle={styles.contents}>
      <View style={[styles.top, { backgroundColor: colors.rollpe_primary }]}>
        <Text style={[styles.nickname, { color: colors.rollpe_secondary }]}>{t('home.greeting', { name: result.userName })}</Text>
        <Text style={[styles.count, styles.rollpeCount, { color: colors.rollpe_secondary }]}>{t('home.hostCount', { count: result.status?.host ?? '—' })}</Text>
        <Text style={[styles.count, styles.heartCount, { color: colors.rollpe_secondary }]}>{t('home.heartCount', { count: result.status?.heart ?? '—' })}</Text>
        {result.statusError && failure(result.statusError)}
        <PrimaryButton title={t('home.invited')} onPress={unavailable} style={styles.invited} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/create-rollpe')}
          style={[styles.create, { borderColor: colors.rollpe_main, backgroundColor: colors.rollpe_primary }]}>
          <Text style={[styles.createText, { color: colors.rollpe_main }]}>{t('common.createRollpe')}</Text>
        </Pressable>
      </View>
      <View style={[styles.hot, { backgroundColor: colors.rollpe_section_background }]}>
        <Text accessibilityRole="header" style={[styles.hotTitle, { color: colors.rollpe_secondary }]}>{t('home.hot')}</Text>
        <View style={styles.grid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
          {result.rollpesError ? failure(result.rollpesError) : result.rollpes?.map(rollpe => <View key={rollpe.id} style={{ width: Math.max(0, (gridWidth - 12) / 2) }}>
            <RollpeCard rollpe={rollpe} onPress={unavailable} />
          </View>)}
        </View>
      </View>
      <AppFooter />
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel={t('home.menuOpen')} accessibilityState={{ expanded: menuOpen }}
      hitSlop={8} onPress={() => setMenuOpen(true)} style={[styles.menuButton, { top: safeArea('top', 20), backgroundColor: colors.rollpe_primary }]}>
      <Image source={require('@/assets/images/home/menu.svg')} accessible={false} contentFit="contain" style={styles.menuIcon} />
    </Pressable>
    {menuOpen && <HomeSideMenu onClose={() => setMenuOpen(false)} onUnavailable={unavailable} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contents: { flexGrow: 1, backgroundColor: '#F4F4F4' },
  top: { paddingTop: 40, paddingHorizontal: 20, paddingBottom: 36 },
  nickname: { fontFamily: RollpeFonts.display, fontSize: 24 },
  count: { fontFamily: RollpeFonts.display, fontSize: 16 },
  rollpeCount: { marginTop: 8 },
  heartCount: { marginTop: 4 },
  invited: { marginTop: 40 },
  create: { marginTop: 8, borderWidth: 2, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center' },
  createText: { fontFamily: RollpeFonts.semibold, fontSize: 16 },
  hot: { paddingTop: 44, paddingHorizontal: 20, paddingBottom: 44, flexGrow: 1 },
  hotTitle: { fontFamily: RollpeFonts.display, fontSize: 24 },
  grid: { marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 16 },
  menuButton: { position: 'absolute', right: 20, width: 28, height: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { width: 16, height: 14 },
  failure: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  error: { fontFamily: RollpeFonts.regular, fontSize: 14 },
});
