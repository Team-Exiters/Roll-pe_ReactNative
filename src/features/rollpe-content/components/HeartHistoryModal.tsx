import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { fetchHeartRevisions, type HeartRevision } from '@/features/rollpe-content/revisions';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

type HistoryProps = { code: string; onClose: () => void; onAuthenticationRequired: () => void };
export function HeartHistoryModal(props: HistoryProps) {
  return (
    <AppModal visible onClose={props.onClose}>
      <HeartHistoryContent {...props} />
    </AppModal>
  );
}
export function HeartHistoryContent({ code, onClose, onAuthenticationRequired }: HistoryProps) {
  const { t } = useTranslation(),
    colors = useRollpeColors(),
    { height } = useWindowDimensions();
  const [revisions, setRevisions] = useState<HeartRevision[]>([]),
    [error, setError] = useState('');
  const [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetchHeartRevisions(code, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setRevisions(value);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
        else setError(cause instanceof Error ? cause.message : t('history.failed'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code, attempt, onAuthenticationRequired, t]);
  function reload() {
    setLoading(true);
    setError('');
    setAttempt((value) => value + 1);
  }
  return (
    <View
      accessibilityViewIsModal
      style={[styles.content, { height: height * 0.62, backgroundColor: colors.rollpe_primary }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('history.close')}
        onPress={onClose}
        hitSlop={12}
        style={styles.close}
      >
        <Image
          source={require('@/assets/images/home/close.svg')}
          tintColor={colors.rollpe_secondary}
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>
        {t('history.title')}
      </Text>
      {loading ? (
        <ActivityIndicator
          style={styles.loading}
          accessibilityLabel={t('history.loading')}
          color={colors.rollpe_main}
        />
      ) : error ? (
        <View style={styles.failure}>
          <Text
            accessibilityRole="alert"
            style={[styles.description, { color: colors.rollpe_secondary }]}
          >
            {error}
          </Text>
          <PrimaryButton
            title={t('common.retry')}
            textStyle={styles.description}
            onPress={() => reload()}
          />
        </View>
      ) : (
        <ScrollView
          style={[styles.list, { borderColor: colors.rollpe_secondary }]}
          contentContainerStyle={styles.rows}
        >
          {revisions.map((revision) => (
            <View
              key={revision.number}
              style={[styles.revision, { borderColor: colors.rollpe_gray }]}
            >
              <View style={styles.heading}>
                <View style={[styles.swatch, { backgroundColor: revision.color }]} />
                <Text style={[styles.label, { color: colors.rollpe_secondary }]}>
                  {t(
                    revision.number
                      ? 'history.revision'
                      : revision.baseline
                        ? 'history.baseline'
                        : 'history.original',
                    { count: revision.number },
                  )}
                </Text>
              </View>
              <Text style={[styles.date, { color: colors.rollpe_secondary }]}>
                {new Date(revision.recordedAt).toLocaleString('ko-KR')}
              </Text>
              <Text style={[styles.text, { color: colors.rollpe_secondary }]}>
                {revision.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { borderRadius: 16, paddingHorizontal: 20, paddingBottom: 20 },
  close: { position: 'absolute', top: 28, left: 20, width: 20, height: 20, zIndex: 1 },
  title: { marginTop: 24, fontFamily: RollpeFonts.display, fontSize: 28, textAlign: 'center' },
  loading: { flex: 1 },
  failure: { flex: 1, justifyContent: 'center', gap: 20 },
  list: { marginTop: 28, borderWidth: 2, borderRadius: 16 },
  rows: { paddingHorizontal: 16, paddingVertical: 4 },
  revision: { paddingVertical: 16, borderBottomWidth: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#888888',
  },
  label: { fontFamily: RollpeFonts.display, fontSize: 20 },
  date: { fontFamily: RollpeFonts.display, fontSize: 12, marginTop: 8 },
  text: { fontFamily: RollpeFonts.display, fontSize: 16, lineHeight: 24, marginTop: 12 },
  description: { fontFamily: RollpeFonts.display, fontSize: 16 },
});
