import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppDialog } from '@/components/ui/AppDialog';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import {
  changeUserBlock,
  fetchBlockedUsers,
  type BlockedUser,
  type BlockedUserPage,
} from '@/features/user-blocking/api';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const safeArea = useSafeAreaSpacing();
  const router = useRouter();
  const { openWelcome, openMainScreen } = useAppNavigation();
  const [result, setResult] = useState<BlockedUserPage | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<BlockedUser | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(true);
  const operation = useRef<AbortController | null>(null);

  const runRequest = useCallback(
    async <T,>(
      request: (signal: AbortSignal) => Promise<T>,
      onSuccess: (value: T) => void,
      onError: () => void,
    ) => {
      if (operation.current) return;
      const controller = new AbortController();
      operation.current = controller;
      setBusy(true);
      try {
        const value = await request(controller.signal);
        if (!controller.signal.aborted) onSuccess(value);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof AuthenticationRequiredError) openWelcome();
        else onError();
      } finally {
        if (operation.current === controller) {
          operation.current = null;
          setBusy(false);
        }
      }
    },
    [openWelcome],
  );

  useFocusEffect(
    useCallback(() => {
      if (attempt > 0) setNotice('');
      setSelected(null);
      setError('');
      void runRequest(
        (signal) => fetchBlockedUsers(1, signal),
        setResult,
        () => {
          setResult(null);
          setError(t('blocking.loadFailed'));
        },
      );
      return () => {
        operation.current?.abort();
        operation.current = null;
      };
    }, [attempt, runRequest, t]),
  );

  function more() {
    const nextPage = result?.nextPage;
    if (!nextPage) return;
    void runRequest(
      (signal) => fetchBlockedUsers(nextPage, signal),
      (page) =>
        setResult((current) => {
          if (!current) return current;
          const ids = new Set(current.items.map((item) => item.id));
          return {
            ...page,
            items: [...current.items, ...page.items.filter((item) => !ids.has(item.id))],
          };
        }),
      () => setNotice(t('blocking.loadFailed')),
    );
  }
  function unblock() {
    if (!selected || operation.current) return;
    const user = selected;
    setSelected(null);
    void runRequest(
      (signal) => changeUserBlock(user.id, false, signal),
      () => setAttempt((value) => value + 1),
      () => setNotice(t('blocking.failed')),
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') },
      ]}
    >
      <View style={styles.header}>
        <BackButton
          style={styles.back}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else openMainScreen('my-page');
          }}
        />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>
          {t('blocking.title')}
        </Text>
      </View>
      <FlatList
        data={result?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.contents, { paddingBottom: safeArea('bottom', 40) }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={[styles.description, { color: colors.rollpe_secondary }]}>
            {t('blocking.description')}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.identity}>
              <Text style={[styles.name, { color: colors.rollpe_secondary }]}>{item.name}</Text>
              <Text style={[styles.code, { color: colors.rollpe_secondary }]}>
                {item.identifyCode}
              </Text>
            </View>
            <OutlineButton
              title={t('blocking.unblock')}
              textStyle={styles.buttonText}
              disabled={busy}
              accessibilityLabel={t('blocking.unblockLabel', { name: item.name })}
              onPress={() => setSelected(item)}
            />
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.rollpe_gray }]} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text
              accessibilityRole={error ? 'alert' : undefined}
              style={[styles.name, { color: colors.rollpe_secondary }]}
            >
              {error || (!busy ? t('blocking.empty') : '')}
            </Text>
            {Boolean(error) && (
              <PrimaryButton
                title={t('common.retry')}
                onPress={() => setAttempt((value) => value + 1)}
              />
            )}
          </View>
        }
        ListFooterComponent={
          result?.nextPage ? (
            <PrimaryButton
              title={t('search.more')}
              disabled={busy}
              onPress={more}
            />
          ) : undefined
        }
      />
      {selected && (
        <AppDialog
          message={t('blocking.confirmUnblock', { name: selected.name })}
          confirmLabel={t('blocking.unblock')}
          onCancel={() => setSelected(null)}
          onConfirm={unblock}
        />
      )}
      {Boolean(notice) && (
        <AppDialog message={notice} onConfirm={() => setNotice('')} />
      )}
      {busy && <LoadingView accessibilityLabel={t('common.processing')} />}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 100, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20 },
  back: { position: 'absolute', left: 0, top: 37 },
  title: { fontFamily: RollpeFonts.display, fontSize: 28 },
  contents: { flexGrow: 1, paddingHorizontal: 20 },
  description: {
    fontFamily: RollpeFonts.display,
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  separator: { height: 1 },
  identity: { flex: 1, gap: 4 },
  name: { fontFamily: RollpeFonts.display, fontSize: 20 },
  code: { fontFamily: RollpeFonts.display, fontSize: 14 },
  buttonText: { fontFamily: RollpeFonts.display, fontSize: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
});
