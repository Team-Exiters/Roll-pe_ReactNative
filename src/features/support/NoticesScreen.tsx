import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { fetchNotices, type NoticeSummary } from '@/features/support/api';
import { SupportLayout } from '@/features/support/components/SupportLayout';
import { useTranslation } from '@/i18n';
import type { ApiPage } from '@/lib/api-response';

export default function NoticesScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  const [result, setResult] = useState<ApiPage<NoticeSummary> | null>(null);
  const [busy, setBusy] = useState(true);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const operation = useRef<AbortController | null>(null);
  const error = failedPage ? t('notices.failed') : '';

  const loadPage = useCallback(async (page: number) => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailedPage(null);
    try {
      const data = await fetchNotices(page, controller.signal);
      if (controller.signal.aborted) return;
      setResult((previous) => {
        if (page === 1 || !previous) return data;
        const ids = new Set(previous.items.map((item) => item.id));
        return {
          ...data,
          items: [...previous.items, ...data.items.filter((item) => !ids.has(item.id))],
        };
      });
    } catch {
      if (!controller.signal.aborted) setFailedPage(page);
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Returning from a detail refreshes the first page instead of appending stale pages.
      void loadPage(1);
      return () => {
        operation.current?.abort();
        operation.current = null;
      };
    }, [loadPage]),
  );

  return (
    <SupportLayout title={t('home.notices')}>
      <FlatList
        data={result?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.contents}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => router.navigate({ pathname: '/notices/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.title, { color: colors.rollpe_secondary }]}>{item.title}</Text>
            <Text style={[styles.date, { color: colors.team_exiters }]}>
              {new Date(item.publishedAt).toLocaleDateString('ko-KR')}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.rollpe_gray }]} />
        )}
        ListEmptyComponent={
          !busy ? (
            <View style={styles.empty}>
              <Text
                accessibilityRole={error ? 'alert' : undefined}
                style={[styles.text, { color: colors.rollpe_secondary }]}
              >
                {error || t('notices.empty')}
              </Text>
              {Boolean(error) && (
                <PrimaryButton
                  title={t('common.retry')}
                  onPress={() => void loadPage(failedPage ?? 1)}
                />
              )}
            </View>
          ) : undefined
        }
        ListFooterComponent={
          result && result.items.length > 0 && (failedPage || result.nextPage) ? (
            <View style={styles.footer}>
              {Boolean(error) && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.text, { color: colors.rollpe_secondary }]}
                >
                  {error}
                </Text>
              )}
              <PrimaryButton
                title={t(error ? 'common.retry' : 'search.more')}
                disabled={busy}
                onPress={() => {
                  const page = failedPage ?? result.nextPage;
                  if (page) void loadPage(page);
                }}
              />
            </View>
          ) : undefined
        }
      />
      {busy && <LoadingView accessibilityLabel={t('notices.loading')} />}
    </SupportLayout>
  );
}

const styles = StyleSheet.create({
  contents: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  item: { paddingVertical: 24, gap: 12 },
  title: { fontFamily: RollpeFonts.display, fontSize: 22, lineHeight: 30 },
  date: { fontFamily: RollpeFonts.display, fontSize: 14 },
  separator: { height: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  footer: { gap: 16, paddingTop: 24 },
  text: { fontFamily: RollpeFonts.display, fontSize: 18, textAlign: 'center' },
});
