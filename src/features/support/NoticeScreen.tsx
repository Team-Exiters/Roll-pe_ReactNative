import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { fetchNotice, type Notice } from '@/features/support/api';
import { HtmlBody } from '@/features/support/components/HtmlBody';
import { SupportLayout } from '@/features/support/components/SupportLayout';
import { useTranslation } from '@/i18n';

export default function NoticeScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return (
    <NoticeContent
      key={String(id)}
      id={typeof id === 'string' && /^[1-9]\d*$/.test(id) ? Number(id) : 0}
    />
  );
}

function NoticeContent({ id }: { id: number }) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const operation = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try {
      const value = await fetchNotice(id, controller.signal);
      if (!controller.signal.aborted) setNotice(value);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setNotice(null);
        setError(cause instanceof Error ? cause.message : t('notices.failed'));
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setBusy(false);
      }
    }
  }, [id, t]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        operation.current?.abort();
        operation.current = null;
      };
    }, [load]),
  );
  return (
    <SupportLayout title={t('home.notices')}>
      {notice && (
        <>
          <View style={styles.heading}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.rollpe_secondary }]}
            >
              {notice.title}
            </Text>
            <Text style={[styles.date, { color: colors.team_exiters }]}>
              {new Date(notice.publishedAt).toLocaleDateString('ko-KR')}
            </Text>
          </View>
          <HtmlBody html={notice.body} />
        </>
      )}
      {Boolean(error) && (
        <View style={styles.failure}>
          <Text accessibilityRole="alert" style={[styles.text, { color: colors.rollpe_secondary }]}>
            {error}
          </Text>
          <PrimaryButton title={t('common.retry')} disabled={busy} onPress={() => void load()} />
        </View>
      )}
      {busy && <LoadingView accessibilityLabel={t('notices.loading')} />}
    </SupportLayout>
  );
}

const styles = StyleSheet.create({
  heading: { marginHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 12 },
  title: { fontFamily: RollpeFonts.display, fontSize: 24, lineHeight: 32 },
  date: { fontFamily: RollpeFonts.display, fontSize: 14 },
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 24 },
  text: { fontFamily: RollpeFonts.display, fontSize: 18, textAlign: 'center' },
});
