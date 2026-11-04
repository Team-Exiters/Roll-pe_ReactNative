import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useRollpeColors } from '@/constants/theme';
import { AppDialog } from '@/components/ui/AppDialog';
import { HeartModal } from '@/features/rollpe-content/components/HeartModal';
import { PaperCanvas } from '@/features/rollpe-content/components/PaperCanvas';
import { fetchRollpeInfo, RollpeAccessError } from '@/features/rollpe-info/api';
import { normalizeRollpeCode, rollpeRole, type RollpeInfo } from '@/features/rollpe-info/model';
import { getTokenState, type TokenState } from '@/features/sign-in/token-state';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export default function RollpeContentScreen() {
  const { code: value } = useLocalSearchParams<{ code?: string | string[] }>();
  const code = normalizeRollpeCode(value);
  return code ? <RollpeContent key={code} code={code} /> : <Redirect href="/rollpe-error" />;
}

function RollpeContent({ code }: { code: string }) {
  const { t } = useTranslation(),
    colors = useRollpeColors(),
    safeArea = useSafeAreaSpacing(),
    router = useRouter();
  const [result, setResult] = useState<{ paper: RollpeInfo; user: TokenState['user'] } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef(false);
  const authenticate = useCallback(() => {
    router.replace({ pathname: '/sign-in', params: { returnTo: `/rollpe/${code}` } });
  }, [code, router]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      const controller = new AbortController();
      setLoading(true);
      setNow(Date.now());
      if (version > 0) setError('');
      void (async () => {
        try {
          const tokenState = await getTokenState();
          if (!tokenState) throw new AuthenticationRequiredError();
          const paper = await fetchRollpeInfo(code, controller.signal);
          if (!controller.signal.aborted) {
            setResult({ paper, user: tokenState.user });
            setError('');
          }
        } catch (cause) {
          if (controller.signal.aborted) return;
          // Failed revalidation must also remove open hearts, not only hide the canvas.
          setResult(null);
          setSelected(null);
          setNotice(null);
          if (cause instanceof AuthenticationRequiredError) authenticate();
          else if (cause instanceof RollpeAccessError) {
            router.replace(cause.reason === 'unavailable' ? '/rollpe-error' : `/rollpe/${code}`);
          } else setError(cause instanceof Error ? cause.message : t('info.loadFailed'));
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
      const timer = setInterval(() => setNow(Date.now()), 10_000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          setNow(Date.now());
          setVersion((value) => value + 1);
        }
      });
      return () => {
        active.current = false;
        controller.abort();
        clearInterval(timer);
        subscription.remove();
      };
    }, [code, version, authenticate, router, t]),
  );

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace(`/rollpe/${code}`);
  }
  function select(index: number) {
    if (!result || loading) return;
    const paper = result.paper;
    if (
      !paper.hearts.data.some((heart) => heart.index === index) &&
      paper.hearts.data.some((heart) => heart.author.id === result.user.id)
    ) {
      if (Platform.OS === 'web') setNotice(t('heart.alreadyWritten'));
      else
        Alert.alert(t('common.notice'), t('heart.alreadyWritten'), [{ text: t('common.confirm') }]);
      return;
    }
    setSelected(index);
  }
  const role = result ? rollpeRole(result.paper, result.user.id, now) : null;
  if (role === 'receiver') return <Redirect href={`/rollpe/${code}`} />;
  if (role === 'unavailable') return <Redirect href="/rollpe-error" />;
  return (
    <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
      {error ? (
        <View style={styles.failure}>
          <Text accessibilityRole="alert">{error}</Text>
          <PrimaryButton
            title={t('common.retry')}
            onPress={() => setVersion((value) => value + 1)}
          />
        </View>
      ) : (
        result && (
          <PaperCanvas
            paper={result.paper}
            disabled={loading || selected !== null || notice !== null}
            onMemoPress={select}
          />
        )
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('heart.closePaper')}
        hitSlop={12}
        onPress={close}
        style={[styles.close, { top: safeArea('top', 20) }]}
      >
        <Image
          source={require('@/assets/images/home/close.svg')}
          tintColor={colors.rollpe_secondary}
          contentFit="contain"
          accessible={false}
          style={styles.icon}
        />
      </Pressable>
      {result && selected !== null && (
        <HeartModal
          key={selected}
          paper={result.paper}
          user={result.user}
          index={selected}
          heart={result.paper.hearts.data.find((heart) => heart.index === selected)}
          onClose={() => setSelected(null)}
          onChanged={() => {
            if (active.current) {
              setSelected(null);
              setVersion((value) => value + 1);
            }
          }}
          onAuthenticationRequired={authenticate}
        />
      )}
      {notice && <AppDialog message={notice} onConfirm={() => setNotice(null)} />}
      {loading && <LoadingView accessibilityLabel={t('info.loading')} />}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  close: { position: 'absolute', left: 20 },
  icon: { width: 20, height: 20 },
  failure: { flex: 1, justifyContent: 'center', padding: 20, gap: 20 },
});
