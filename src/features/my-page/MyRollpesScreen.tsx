import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppSideMenu } from '@/components/AppSideMenu';
import { RollpeListItem } from '@/components/rollpe/RollpeListItem';
import { AppDialog } from '@/components/ui/AppDialog';
import { BackButton } from '@/components/ui/BackButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { dDay } from '@/features/home/api';
import {
  canOpenMyRollpe,
  fetchMyRollpes,
  isMyRollpeDelivered,
  isMyRollpeKind,
  myRollpeTitles,
  type MyRollpe,
  type MyRollpeKind,
  type MyRollpePage,
} from '@/features/my-page/api';
import { getTokenState } from '@/features/sign-in/token-state';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export default function MyRollpesScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string | string[] }>();
  return isMyRollpeKind(kind) ? (
    <MyRollpesContent key={kind} kind={kind} />
  ) : (
    <Redirect href="/my-page" />
  );
}

function MyRollpesContent({ kind }: { kind: MyRollpeKind }) {
  const { t } = useTranslation(),
    colors = useRollpeColors(),
    safeArea = useSafeAreaSpacing(),
    router = useRouter();
  const [result, setResult] = useState<{ page: MyRollpePage; userId: number } | null>(null);
  const [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(true),
    [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(''),
    [moreError, setMoreError] = useState(''),
    [notice, setNotice] = useState(''),
    [menu, setMenu] = useState(false);
  const request = useRef<AbortController | null>(null),
    pending = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (attempt > 0) setNotice('');
      const controller = new AbortController();
      request.current = controller;
      pending.current = true;
      setLoading(true);
      setLoadingMore(false);
      setError('');
      setMoreError('');
      setResult(null);
      void (async () => {
        try {
          const token = await getTokenState();
          if (!token) throw new AuthenticationRequiredError();
          if (controller.signal.aborted) return;
          const page = await fetchMyRollpes(kind, 1, controller.signal);
          if (!controller.signal.aborted) setResult({ page, userId: token.user.id });
        } catch (cause) {
          if (controller.signal.aborted) return;
          if (cause instanceof AuthenticationRequiredError) router.replace('/sign-in');
          else setError(t('myPage.listFailed'));
        } finally {
          if (!controller.signal.aborted) {
            pending.current = false;
            setLoading(false);
          }
        }
      })();
      return () => {
        controller.abort();
        request.current?.abort();
        pending.current = false;
      };
    }, [kind, attempt, router, t]),
  );

  async function more() {
    if (pending.current || !result?.page.nextPage) return;
    pending.current = true;
    setLoadingMore(true);
    setMoreError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const page = await fetchMyRollpes(kind, result.page.nextPage, controller.signal);
      if (!controller.signal.aborted)
        setResult((current) => {
          if (!current) return current;
          const codes = new Set(current.page.items.map((item) => item.code));
          return {
            ...current,
            page: {
              ...page,
              items: [...current.page.items, ...page.items.filter((item) => !codes.has(item.code))],
            },
          };
        });
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) router.replace('/sign-in');
      else setMoreError(t('myPage.listFailed'));
    } finally {
      if (!controller.signal.aborted) {
        pending.current = false;
        setLoadingMore(false);
      }
    }
  }
  function open(paper: MyRollpe) {
    if (!result) return;
    if (!canOpenMyRollpe(paper, result.userId)) {
      setNotice(t('myPage.receiverOnly'));
      return;
    }
    router.push({ pathname: '/rollpe/[code]', params: { code: paper.code } });
  }
  function description(paper: MyRollpe) {
    const date = new Date(paper.createdAt);
    return t('search.hostAndDate', {
      name: paper.host.name,
      date: `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`,
    });
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') },
      ]}
    >
      <View style={styles.navigation}>
        <BackButton
          style={styles.back}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/my-page');
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.goHome')}
          onPress={() => router.dismissTo('/home')}
        >
          <Image
            source={require('@/assets/images/welcome/logo.png')}
            accessible={false}
            contentFit="contain"
            style={styles.logo}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.menuOpen')}
          accessibilityState={{ expanded: menu }}
          hitSlop={8}
          onPress={() => setMenu(true)}
          style={styles.menuButton}
        >
          <Image
            source={require('@/assets/images/home/menu.svg')}
            accessible={false}
            contentFit="contain"
            style={styles.menuIcon}
          />
        </Pressable>
      </View>
      <FlatList
        data={result?.page.items ?? []}
        keyExtractor={(item) => item.code}
        style={styles.list}
        contentContainerStyle={[styles.contents, { paddingBottom: safeArea('bottom', 40) }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        ListHeaderComponent={
          <View>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.rollpe_secondary }]}
            >
              {t(myRollpeTitles[kind])}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.count, { color: colors.rollpe_secondary }]}
            >
              {result ? t('myPage.count', { count: result.page.count }) : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <RollpeListItem
            title={item.title}
            theme={item.theme}
            description={description(item)}
            isPublic={item.isPublic}
            deadline={isMyRollpeDelivered(item) ? t('myPage.delivered') : dDay(item.receivingDate)}
            onPress={() => open(item)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.rollpe_gray }]} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator
                accessibilityLabel={t('myPage.loading')}
                color={colors.rollpe_main}
              />
            ) : (
              <>
                <Text
                  accessibilityRole={error ? 'alert' : undefined}
                  style={[styles.message, { color: colors.rollpe_secondary }]}
                >
                  {error || t(`myPage.empty.${kind}`)}
                </Text>
                {Boolean(error) && (
                  <PrimaryButton
                    title={t('common.retry')}
                    onPress={() => setAttempt((value) => value + 1)}
                  />
                )}
              </>
            )}
          </View>
        }
        ListFooterComponent={
          result?.page.nextPage ? (
            <View style={styles.footer}>
              {Boolean(moreError) && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.message, { color: colors.rollpe_main }]}
                >
                  {moreError}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={loadingMore}
                accessibilityState={{ disabled: loadingMore }}
                onPress={() => {
                  void more();
                }}
                style={({ pressed }) => [
                  styles.more,
                  { borderColor: colors.rollpe_secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {loadingMore ? (
                  <ActivityIndicator
                    color={colors.rollpe_main}
                    accessibilityLabel={t('myPage.loading')}
                  />
                ) : (
                  <Text style={[styles.moreLabel, { color: colors.rollpe_secondary }]}>
                    {t(moreError ? 'common.retry' : 'search.more')}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : undefined
        }
      />
      {menu && <AppSideMenu current="myPage" onClose={() => setMenu(false)} />}
      {Boolean(notice) && <AppDialog message={notice} onConfirm={() => setNotice('')} />}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  navigation: { height: 68, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 0, top: 23.5 },
  logo: { width: 48, height: 24 },
  menuButton: {
    position: 'absolute',
    right: 0,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { width: 16, height: 14 },
  list: { marginHorizontal: 20 },
  contents: { flexGrow: 1 },
  title: { marginTop: 8, fontFamily: RollpeFonts.display, fontSize: 32, textAlign: 'center' },
  count: { marginTop: 32, fontFamily: RollpeFonts.display, fontSize: 20 },
  separator: { height: 2, borderRadius: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 40 },
  message: { fontFamily: RollpeFonts.display, fontSize: 20, textAlign: 'center' },
  footer: { paddingTop: 32, gap: 20 },
  more: {
    height: 48,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLabel: { fontFamily: RollpeFonts.semibold, fontSize: 16 },
});
