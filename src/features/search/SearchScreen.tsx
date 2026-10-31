import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppSideMenu } from '@/components/AppSideMenu';
import { AppDialog } from '@/components/ui/AppDialog';
import { RoundedBorderTextField } from '@/components/ui/RoundedBorderTextField';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { searchRollpes, type SearchPage, type SearchRollpe } from '@/features/search/api';
import { SearchRollpeItem } from '@/features/search/components/SearchRollpeItem';
import { getTokenState } from '@/features/sign-in/token-state';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export default function SearchScreen() {
  const { t } = useTranslation(), colors = useRollpeColors(), safeArea = useSafeAreaSpacing(), router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState({ keyword: '', revision: 0 });
  const [result, setResult] = useState<SearchPage | null>(null);
  const [loading, setLoading] = useState(false), [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(''), [moreError, setMoreError] = useState('');
  const [menu, setMenu] = useState(false), [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null), pending = useRef(false);
  const list = useRef<FlatList<SearchRollpe>>(null);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController(); request.current = controller; pending.current = true;
    setLoading(Boolean(submitted.keyword)); setLoadingMore(false); setError(''); setMoreError(''); setResult(null);
    void (async () => {
      try {
        if (!await getTokenState()) throw new AuthenticationRequiredError();
        if (!submitted.keyword || controller.signal.aborted) return;
        const page = await searchRollpes(submitted.keyword, 1, controller.signal);
        if (!controller.signal.aborted) setResult(page);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof AuthenticationRequiredError) router.replace('/sign-in');
        else setError(cause instanceof Error ? cause.message : t('search.failed'));
      } finally { if (!controller.signal.aborted) { pending.current = false; setLoading(false); } }
    })();
    return () => { controller.abort(); request.current?.abort(); pending.current = false; };
  }, [submitted, router, t]));

  function submit() {
    const query = keyword.trim();
    if (!query) { setNotice(t('search.enterTitle')); return; }
    if (pending.current && query === submitted.keyword) return;
    request.current?.abort(); Keyboard.dismiss(); list.current?.scrollToOffset({ offset: 0, animated: false });
    setSubmitted(value => ({ keyword: query, revision: value.revision + 1 }));
  }
  function retry() { request.current?.abort(); setSubmitted(value => ({ ...value, revision: value.revision + 1 })); }
  async function more() {
    if (pending.current || !submitted.keyword || !result?.nextPage) return;
    pending.current = true; setLoadingMore(true); setMoreError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const page = await searchRollpes(submitted.keyword, result.nextPage, controller.signal);
      if (!controller.signal.aborted) setResult(current => {
        if (!current) return current;
        const codes = new Set(current.items.map(item => item.code));
        return { ...page, items: [...current.items, ...page.items.filter(item => !codes.has(item.code))] };
      });
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) router.replace('/sign-in');
      else setMoreError(t('search.moreFailed'));
    } finally { if (!controller.signal.aborted) { pending.current = false; setLoadingMore(false); } }
  }

  const items = result?.items ?? [];
  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top'), paddingBottom: safeArea('bottom') }]}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList ref={list} data={items} keyExtractor={item => item.code} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} showsVerticalScrollIndicator={false}
        style={styles.list} contentContainerStyle={[styles.contents, { paddingBottom: result?.nextPage ? 4 : 40 }]}
        ListHeaderComponent={<View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{t('search.title')}</Text>
          <View style={styles.search}>
            <RoundedBorderTextField accessibilityLabel={t('search.input')} placeholder={t('search.placeholder')} value={keyword} maxLength={100}
              onChangeText={setKeyword} returnKeyType="search" onSubmitEditing={submit} style={styles.input} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.search')} hitSlop={12} onPress={submit} style={styles.searchButton}>
              <Image source={require('@/assets/images/create-rollpe/search.svg')} tintColor={colors.rollpe_secondary} contentFit="contain" accessible={false} style={styles.searchIcon} />
            </Pressable>
          </View>
          <View style={styles.count}>{Boolean(items.length) && <Text accessibilityLiveRegion="polite" style={[styles.countText, { color: colors.rollpe_secondary }]}>
            {t('search.count', { count: result?.count ?? 0 })}</Text>}</View>
        </View>}
        renderItem={({ item }) => <SearchRollpeItem rollpe={item} onPress={() => router.push({ pathname: '/rollpe/[code]', params: { code: item.code } })} />}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.rollpe_gray }]} />}
        ListEmptyComponent={loading ? <View style={styles.empty}><ActivityIndicator color={colors.rollpe_main} accessibilityLabel={t('search.loading')} /></View>
          : error ? <View style={styles.empty}>
            <Text accessibilityRole="alert" style={[styles.message, { color: colors.rollpe_secondary }]}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={retry}><Text style={[styles.message, { color: colors.rollpe_main }]}>{t('common.retry')}</Text></Pressable>
          </View> : result ? <View style={styles.empty}>
            <Image source={require('@/assets/images/home/close.svg')} tintColor={colors.rollpe_gray} accessible={false} style={styles.emptyIcon} />
            <Text style={[styles.message, { color: colors.rollpe_gray }]}>{t('search.empty')}</Text>
          </View> : undefined}
        ListFooterComponent={result?.nextPage ? <View style={styles.footer}>
          {Boolean(moreError) && <Text accessibilityRole="alert" style={[styles.moreError, { color: colors.rollpe_main }]}>{moreError}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: loadingMore }} disabled={loadingMore} onPress={() => { void more(); }}
            style={[styles.more, { borderColor: colors.rollpe_secondary }]}>
            {loadingMore ? <ActivityIndicator color={colors.rollpe_main} accessibilityLabel={t('search.loading')} />
              : <Text style={[styles.moreText, { color: colors.rollpe_secondary }]}>{t(moreError ? 'common.retry' : 'search.more')}</Text>}
          </Pressable>
        </View> : undefined} />
    </KeyboardAvoidingView>
    <Pressable accessibilityRole="button" accessibilityLabel={t('home.menuOpen')} accessibilityState={{ expanded: menu }} hitSlop={8}
      onPress={() => { Keyboard.dismiss(); setMenu(true); }} style={[styles.menuButton, { top: safeArea('top', 20), backgroundColor: colors.rollpe_primary }]}>
      <Image source={require('@/assets/images/home/menu.svg')} accessible={false} contentFit="contain" style={styles.menuIcon} />
    </Pressable>
    {menu && <AppSideMenu current="search" onClose={() => setMenu(false)} />}
    {Boolean(notice) && <AppDialog message={notice} onConfirm={() => setNotice('')} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, list: { marginHorizontal: 20 }, contents: { flexGrow: 1 }, header: { paddingTop: 40 },
  title: { fontFamily: RollpeFonts.display, fontSize: 24 }, search: { marginTop: 20 }, input: { paddingRight: 54 },
  searchButton: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }, searchIcon: { width: 22, height: 22 },
  count: { marginTop: 76 }, countText: { fontFamily: RollpeFonts.display, fontSize: 20 }, separator: { height: 2, borderRadius: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40, paddingVertical: 40 }, emptyIcon: { width: 64, height: 64 },
  message: { fontFamily: RollpeFonts.display, fontSize: 20, textAlign: 'center' }, footer: { paddingTop: 32 },
  more: { height: 48, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: RollpeFonts.semibold, fontSize: 16 }, moreError: { fontFamily: RollpeFonts.display, fontSize: 16, textAlign: 'center', marginBottom: 20 },
  menuButton: { position: 'absolute', right: 20, width: 28, height: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { width: 16, height: 14 },
});
