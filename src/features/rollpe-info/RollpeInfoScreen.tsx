import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { RollpePaper } from '@/components/rollpe/RollpePaper';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { MarqueeText } from '@/components/ui/MarqueeText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { enterRollpe, fetchRollpeInfo, RollpeAccessError } from '@/features/rollpe-info/api';
import { RollpeEntry } from '@/features/rollpe-info/components/RollpeEntry';
import { RollpeActionDialog } from '@/features/rollpe-info/components/RollpeActionDialog';
import { canDeleteRollpe, canSendRollpe, isRollpeDelivered, normalizeRollpeCode, remainingTime, reportRollpeUrl, rollpeRole, rollpeShareUrl, type RollpeAction, type RollpeInfo } from '@/features/rollpe-info/model';
import { saveRollpeImage } from '@/features/rollpe-info/save-image';
import { getTokenState, type TokenState } from '@/features/sign-in/token-state';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';

export default function RollpeInfoScreen() {
  const params = useLocalSearchParams<{ code?: string | string[]; title?: string; public?: string }>();
  const code = normalizeRollpeCode(params.code);
  if (!code) return <Redirect href="/rollpe-error" />;
  return <RollpeInfoContent key={code} code={code} title={typeof params.title === 'string' ? params.title.slice(0, 100) : ''}
    isPublic={params.public === '1' ? true : params.public === '0' ? false : undefined} />;
}

function RollpeInfoContent({ code, title, isPublic }: { code: string; title: string; isPublic?: boolean }) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const safeArea = useSafeAreaSpacing();
  const router = useRouter();
  const [result, setResult] = useState<{ rollpe: RollpeInfo; user: TokenState['user'] } | null>(null);
  const [error, setError] = useState<string>();
  const [entryError, setEntryError] = useState<string>();
  const [needsJoin, setNeedsJoin] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [action, setAction] = useState<RollpeAction | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const request = useRef<AbortController | null>(null);
  const joinPending = useRef(false);
  const actionPending = useRef(false);
  const actionEpoch = useRef(0);
  const managing = useRef(false);
  const focused = useRef(false);
  const exportPaper = useRef<ComponentRef<typeof View>>(null);

  const handleFailure = useCallback((cause: unknown) => {
    if (cause instanceof AuthenticationRequiredError) {
      router.replace({ pathname: '/sign-in', params: { returnTo: `/rollpe/${code}` } });
    } else if (cause instanceof RollpeAccessError && cause.reason === 'unavailable') {
      router.replace('/rollpe-error');
    } else if (cause instanceof RollpeAccessError && cause.reason === 'join') {
      setNeedsJoin(true);
    } else setError(cause instanceof Error ? cause.message : t('info.loadFailed'));
  }, [code, router, t]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (attempt > 0) setEntryError(undefined);
    setBusy(false); setJoining(false); setError(undefined); setLoading(true); setNow(Date.now());
    const controller = new AbortController();
    request.current = controller;
    void (async () => {
      try {
        const tokenState = await getTokenState();
        if (!tokenState) throw new AuthenticationRequiredError();
        if (controller.signal.aborted) return;
        const rollpe = await fetchRollpeInfo(code, controller.signal);
        if (!controller.signal.aborted) { setResult({ rollpe, user: tokenState.user }); setNeedsJoin(false); }
      } catch (cause) { if (!controller.signal.aborted) handleFailure(cause); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(Date.now());
        if (!actionPending.current && !joinPending.current && !managing.current) setAttempt(value => value + 1);
      }
    });
    return () => {
      focused.current = false; ++actionEpoch.current; actionPending.current = false; joinPending.current = false;
      controller.abort(); request.current?.abort(); clearInterval(timer); subscription.remove();
    };
  }, [code, attempt, handleFailure]));

  function goBack() { if (router.canGoBack()) router.back(); else router.replace('/home'); }
  function toggleAction(value: RollpeAction | null) { managing.current = value !== null; setAction(value); }
  function showMessage(message: string, failure = false) {
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert(t(failure ? 'common.error' : 'common.notice'), message, [{ text: t('common.confirm') }]);
  }
  async function join(password?: string) {
    if (joinPending.current) return;
    joinPending.current = true;
    setJoining(true); setEntryError(undefined);
    const controller = new AbortController();
    request.current = controller;
    try {
      await enterRollpe(code, password, controller.signal);
      if (!controller.signal.aborted) { setNeedsJoin(false); setAttempt(value => value + 1); }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError || (cause instanceof RollpeAccessError && cause.reason === 'unavailable')) handleFailure(cause);
      else {
        if (cause instanceof RollpeAccessError && cause.reason === 'password') setPasswordRequired(true);
        setEntryError(cause instanceof Error ? cause.message : t('info.joinFailed'));
      }
    } finally {
      if (request.current === controller) { joinPending.current = false; if (!controller.signal.aborted) setJoining(false); }
    }
  }
  async function runAction(action: () => Promise<void>, success?: string) {
    if (actionPending.current) return;
    actionPending.current = true;
    const epoch = actionEpoch.current;
    setBusy(true);
    try {
      await action();
      if (focused.current && epoch === actionEpoch.current && success) showMessage(success);
    } catch (cause) {
      if (focused.current && epoch === actionEpoch.current && !(cause instanceof Error && cause.name === 'AbortError')) {
        showMessage(cause instanceof Error ? cause.message : t('common.genericError'), true);
      }
    } finally {
      if (epoch === actionEpoch.current) { actionPending.current = false; if (focused.current) setBusy(false); }
    }
  }
  async function share() {
    if (!result) return;
    const website = process.env.EXPO_PUBLIC_WEB_URL ?? (Platform.OS === 'web' ? window.location.origin : undefined);
    const url = rollpeShareUrl(code, website);
    const message = t('info.shareMessage', { name: result.rollpe.host.name, url });
    if (Platform.OS !== 'web') { await Share.share({ message }); return; }
    if (navigator.share) await navigator.share({ text: message });
    else {
      if (!navigator.clipboard) throw new Error(t('info.shareFailed'));
      await navigator.clipboard.writeText(message);
      if (focused.current) showMessage(t('info.linkCopied'));
    }
  }

  const role = result ? rollpeRole(result.rollpe, result.user.id, now) : null;
  if (role === 'unavailable' && !action) return <Redirect href="/rollpe-error" />;
  const rollpe = result?.rollpe;
  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') }]}>
    <View style={styles.navigation}>
      <BackButton onPress={goBack} style={styles.back} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.goHome')} onPress={() => router.dismissTo('/home')}>
        <Image source={require('@/assets/images/welcome/logo.png')} accessible={false} contentFit="contain" style={styles.logo} />
      </Pressable>
    </View>
    {error ? <View style={styles.failure}>
      <Text accessibilityRole="alert" style={[styles.description, { color: colors.rollpe_secondary }]}>{error}</Text>
      <PrimaryButton title={t('common.retry')} onPress={() => setAttempt(value => value + 1)} />
    </View> : rollpe && <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.contents} showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}>
        <View style={styles.title}><MarqueeText text={rollpe.title} size={32} color={colors.rollpe_secondary} centered /></View>
        <Text style={[styles.countdown, { color: colors.rollpe_secondary }]}>{isRollpeDelivered(rollpe, now)
          ? t('info.closed') : remainingTime(rollpe.receive.receivingDate, now)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('info.openPaper')} style={styles.paper}
          onPress={() => showMessage(t(role === 'receiver' ? 'info.noMoreWriting' : 'common.comingSoon'))}>
          <RollpePaper key={`${rollpe.code}:${rollpe.theme}:${rollpe.ratio}`} {...rollpe} messages={rollpe.hearts.data} />
        </Pressable>
        <Text style={[styles.explanation, { color: colors.rollpe_secondary }]}>{t('info.explanation')}</Text>
        <Text style={[styles.writers, { color: colors.rollpe_secondary }]}>{t('info.writers', { count: rollpe.hearts.count, max: rollpe.maxHeartLength })}</Text>
        <View style={styles.writerList}>{rollpe.hearts.data.map(heart =>
          <Text key={heart.id} numberOfLines={1} style={[styles.writer, { color: colors.rollpe_secondary }]}>
            {heart.author.name}({heart.author.identifyCode})
          </Text>)}</View>
      </ScrollView>
      <View style={[styles.buttons, { marginBottom: safeArea('bottom') }]}>
        {role === 'receiver' ? <PrimaryButton title={t('info.saveImage')} disabled={busy || !ready}
          onPress={() => { void runAction(() => saveRollpeImage(exportPaper.current, `rollpe-${code}`), t('info.saved')); }} />
          : <><View style={styles.row}>
            <PrimaryButton title={t('info.share')} disabled={busy} style={styles.share} onPress={() => { void runAction(share); }} />
            {role === 'participant' && <Pressable accessibilityRole="button" accessibilityLabel={t('info.report')} disabled={busy}
              onPress={() => { void runAction(async () => {
                await Linking.openURL(reportRollpeUrl(code, result?.user.identifyCode ?? ''));
              }); }} style={[styles.report, { borderColor: colors.rollpe_main }]}>
              <Image source={require('@/assets/icons/icon_siren.svg')} accessible={false} contentFit="contain" style={styles.reportIcon} />
            </Pressable>}
          </View>
          {result && canDeleteRollpe(rollpe, result.user.id, now) && <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={loading || busy || needsJoin}
              accessibilityState={{ disabled: loading || busy || needsJoin }} onPress={() => toggleAction('delete')}
              style={[styles.deleteButton, { borderColor: colors.rollpe_main, opacity: loading || busy || needsJoin ? 0.5 : 1 }]}>
              <Text style={[styles.deleteLabel, { color: colors.rollpe_main }]}>{t('info.deleteAction')}</Text>
            </Pressable>
            <PrimaryButton title={t('info.sendAction')} style={styles.share} disabled={loading || busy || needsJoin || !canSendRollpe(rollpe, result.user.id, now)}
              accessibilityHint={!rollpe.receive.receiver ? t('info.sendRecipientRequired') : undefined} onPress={() => toggleAction('send')} />
          </View>}</>}
      </View>
      {role === 'receiver' && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.export}>
        <RollpePaper {...rollpe} messages={rollpe.hearts.data} width={rollpe.ratio === '세로' ? 595 : 842}
          shadow={false} paperRef={exportPaper} onReadyChange={setReady} />
      </View>}
    </>}
    {needsJoin && <RollpeEntry title={title} isPublic={passwordRequired ? false : isPublic} error={entryError} busy={joining}
      onSubmit={password => { void join(password); }} onCancel={goBack} />}
    {action && result && <RollpeActionDialog key={action} action={action} paper={result.rollpe} userId={result.user.id} onClose={() => toggleAction(null)}
      onCompleted={() => { router.dismissAll(); router.replace('/home'); }}
      onReload={() => { toggleAction(null); setAttempt(value => value + 1); }}
      onAuthenticationRequired={() => { toggleAction(null); handleFailure(new AuthenticationRequiredError()); }} />}
    {(loading || busy) && <LoadingView accessibilityLabel={t(busy ? 'common.processing' : 'info.loading')} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, navigation: { height: 68, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 0, top: 23.5 }, logo: { width: 48, height: 24 },
  scroll: { flex: 1, marginHorizontal: 20, marginBottom: 40 }, contents: { paddingTop: 20 },
  title: { marginHorizontal: 20 }, countdown: { marginTop: 4, textAlign: 'center', fontFamily: RollpeFonts.display, fontSize: 14 },
  paper: { marginTop: 52 }, explanation: { marginTop: 16, textAlign: 'center', fontFamily: RollpeFonts.display, fontSize: 16 },
  writers: { marginTop: 40, fontFamily: RollpeFonts.display, fontSize: 20 }, writerList: { marginTop: 20, gap: 8 },
  writer: { fontFamily: RollpeFonts.display, fontSize: 20 }, buttons: { marginHorizontal: 20, gap: 8 },
  row: { flexDirection: 'row', gap: 8 }, share: { flex: 1 },
  deleteButton: { flex: 1, borderWidth: 2, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center' },
  deleteLabel: { fontFamily: RollpeFonts.semibold, fontSize: 16, textAlign: 'center' },
  report: { width: 52, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  reportIcon: { width: 20, height: 20 }, failure: { flex: 1, justifyContent: 'center', padding: 20, gap: 20 },
  description: { fontFamily: RollpeFonts.regular, fontSize: 16, textAlign: 'center' },
  export: { position: 'absolute', left: -10000, top: 0 },
});
