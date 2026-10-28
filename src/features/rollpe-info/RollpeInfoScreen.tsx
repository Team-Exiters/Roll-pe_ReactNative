import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RollpePaper } from '@/components/rollpe/RollpePaper';
import { BackButton } from '@/components/ui/BackButton';
import { LoadingView } from '@/components/ui/LoadingView';
import { MarqueeText } from '@/components/ui/MarqueeText';
import { AppDialog } from '@/components/ui/AppDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { enterRollpe, fetchRollpeInfo, RollpeAccessError, type RollpeEntryInfo } from '@/features/rollpe-info/api';
import { RollpeEntry } from '@/features/rollpe-info/components/RollpeEntry';
import { RollpeActionDialog } from '@/features/rollpe-info/components/RollpeActionDialog';
import { ParticipantModal } from '@/features/rollpe-info/components/ParticipantModal';
import { ShareRollpeModal } from '@/features/rollpe-info/components/ShareRollpeModal';
import { RollpeManagementModal } from '@/features/rollpe-info/components/RollpeManagementModal';
import { HeartHistoryModal } from '@/features/rollpe-content/components/HeartHistoryModal';
import { isRollpeDelivered, normalizeRollpeCode, remainingTime, reportRollpeUrl, rollpeRole, type RollpeInfo } from '@/features/rollpe-info/model';
import { saveRollpeImage } from '@/features/rollpe-info/save-image';
import { getTokenState, type TokenState } from '@/features/sign-in/token-state';
import { clearPendingRollpeDestination, rememberRollpeDestination } from '@/features/sign-in/pending-rollpe';
import { InvitationError, respondToInvitation } from '@/features/invitations/api';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';

export default function RollpeInfoScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = normalizeRollpeCode(params.code);
  if (!code) return <Redirect href="/rollpe-error" />;
  return <RollpeInfoContent key={code} code={code} />;
}

function RollpeInfoContent({ code }: { code: string }) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const safeArea = useSafeAreaSpacing();
  const router = useRouter();
  const [result, setResult] = useState<{ rollpe: RollpeInfo; user: TokenState['user'] } | null>(null);
  const [error, setError] = useState<string>();
  const [entryError, setEntryError] = useState<string>();
  const [entry, setEntry] = useState<RollpeEntryInfo | null>(null);
  const needsJoin = entry !== null;
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [action, setAction] = useState<'leave' | null>(null);
  const [members, setMembers] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [management, setManagement] = useState(false);
  const [history, setHistory] = useState<string | null>(null);
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
    if ((cause instanceof RollpeAccessError || cause instanceof InvitationError) && cause.reason === 'full') {
      void clearPendingRollpeDestination(`/rollpe/${code}`);
      setResult(null); setEntry(null); setSignInRequired(false); setError(undefined); setFull(true);
    } else if (cause instanceof AuthenticationRequiredError) {
      void rememberRollpeDestination(`/rollpe/${code}`);
      setResult(null); setEntry(null); setSignInRequired(true);
    } else if (cause instanceof RollpeAccessError && cause.reason === 'unavailable') {
      void clearPendingRollpeDestination(`/rollpe/${code}`);
      router.replace('/rollpe-error');
    } else if (cause instanceof RollpeAccessError && cause.reason === 'join' && cause.entry) {
      void rememberRollpeDestination(`/rollpe/${code}`);
      setResult(null); setEntry(cause.entry);
    } else setError(cause instanceof Error ? cause.message : t('info.loadFailed'));
  }, [code, router, t]);

  const authenticate = useCallback(() => {
    managing.current = false; setMembers(false); setSharing(false); setManagement(false); setHistory(null); setAction(null);
    handleFailure(new AuthenticationRequiredError());
  }, [handleFailure]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (attempt > 0) setEntryError(undefined);
    setBusy(false); setJoining(false); setSignInRequired(false); setFull(false); setEntry(null); setError(undefined); setLoading(true); setNow(Date.now());
    const controller = new AbortController();
    request.current = controller;
    void (async () => {
      try {
        const tokenState = await getTokenState();
        if (!tokenState) throw new AuthenticationRequiredError();
        if (controller.signal.aborted) return;
        const rollpe = await fetchRollpeInfo(code, controller.signal);
        if (!controller.signal.aborted) {
          setResult({ rollpe, user: tokenState.user }); setEntry(null);
          void clearPendingRollpeDestination(`/rollpe/${code}`);
        }
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

  function goBack() {
    void clearPendingRollpeDestination(`/rollpe/${code}`);
    if (signInRequired) { router.dismissAll(); router.replace('/'); }
    else if (router.canGoBack()) router.back();
    else router.replace('/home');
  }
  async function signIn() {
    if (joinPending.current) return;
    joinPending.current = true; setJoining(true);
    const epoch = actionEpoch.current;
    await rememberRollpeDestination(`/rollpe/${code}`);
    if (focused.current && epoch === actionEpoch.current) router.replace({ pathname: '/sign-in', params: { returnTo: `/rollpe/${code}` } });
    if (epoch === actionEpoch.current) { joinPending.current = false; if (focused.current) setJoining(false); }
  }
  function toggleAction(value: 'leave' | null) { managing.current = value !== null; setAction(value); }
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
      if (entry?.invitationCode) await respondToInvitation(entry.invitationCode, 'accept', controller.signal);
      else await enterRollpe(code, password, controller.signal);
      if (!controller.signal.aborted) { setEntry(null); setAttempt(value => value + 1); }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError || (cause instanceof RollpeAccessError && ['unavailable', 'full'].includes(cause.reason))
        || (cause instanceof InvitationError && cause.reason === 'full')) handleFailure(cause);
      else if (cause instanceof InvitationError) { setEntry(null); setError(cause.message); }
      else {
        if (cause instanceof RollpeAccessError && cause.reason === 'password') setEntry(value => value && { ...value, isPublic: false });
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
  const role = result ? rollpeRole(result.rollpe, result.user.id, now) : null;
  if (role === 'unavailable') return <Redirect href="/rollpe-error" />;
  const rollpe = result?.rollpe;
  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') }]}>
    <View style={styles.navigation}>
      <BackButton onPress={goBack} style={styles.back} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.goHome')} onPress={() => {
        void clearPendingRollpeDestination(`/rollpe/${code}`);
        if (signInRequired) { router.dismissAll(); router.replace('/'); } else router.dismissTo('/home');
      }}>
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
          onPress={() => {
            if (role === 'receiver') showMessage(t('info.noMoreWriting'));
            else router.push({ pathname: '/rollpe/[code]/content', params: { code } });
          }}>
          <RollpePaper key={`${rollpe.code}:${rollpe.theme}:${rollpe.ratio}`} {...rollpe} messages={rollpe.hearts.data} />
        </Pressable>
        <Text style={[styles.explanation, { color: colors.rollpe_secondary }]}>{t('info.explanation')}</Text>
        <Text style={[styles.writers, { color: colors.rollpe_secondary }]}>{t('info.writers', { count: rollpe.hearts.count, max: rollpe.maxHeartLength })}</Text>
        <View style={styles.writerList}>{rollpe.hearts.data.map(heart => <View key={heart.id} style={styles.writerRow}>
          <Text numberOfLines={1} style={[styles.writer, { color: colors.rollpe_secondary }]}>{heart.author.name}({heart.author.identifyCode})</Text>
          {(heart.revisionCount ?? 0) > 0 && (result && [rollpe.host.id, heart.author.id].includes(result.user.id)
            ? <Pressable accessibilityRole="button" accessibilityLabel={t('history.forUser', { name: heart.author.name })}
              onPress={() => { managing.current = true; setHistory(heart.code); }}>
              <Text style={[styles.edited, { color: colors.rollpe_main }]}>{t('history.edited')}</Text></Pressable>
            : <Text style={[styles.edited, { color: colors.rollpe_secondary }]}>{t('history.edited')}</Text>)}
        </View>)}</View>
        {role === 'host' && <Pressable accessibilityRole="button" disabled={loading || busy || needsJoin} style={styles.participants}
          onPress={() => { managing.current = true; setMembers(true); }}>
          <Text style={[styles.writer, { color: colors.rollpe_secondary }]}>{t('participants.title')}</Text>
          <Image source={require('@/assets/icons/chevron-right.svg')} tintColor={colors.rollpe_secondary} style={styles.chevron} accessible={false} />
        </Pressable>}
      </ScrollView>
      <View style={[styles.buttons, { marginBottom: safeArea('bottom', 0, 20) }]}>
        {role === 'receiver' ? <PrimaryButton title={t('info.saveImage')} disabled={busy || !ready}
          onPress={() => { void runAction(() => saveRollpeImage(exportPaper.current, `rollpe-${code}`), t('info.saved')); }} />
          : role === 'host' ? <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={loading || busy || needsJoin}
              accessibilityState={{ disabled: loading || busy || needsJoin }} onPress={() => { managing.current = true; setManagement(true); }}
              style={({ pressed }) => [styles.outlinedButton, { borderColor: colors.rollpe_main,
                opacity: loading || busy || needsJoin ? 0.5 : pressed ? 0.7 : 1 }]}>
              <Text style={[styles.outlinedLabel, { color: colors.rollpe_main }]}>{t('settings.open')}</Text>
            </Pressable>
            <PrimaryButton title={t('info.share')} disabled={loading || busy || needsJoin} style={styles.flexButton}
              onPress={() => { managing.current = true; setSharing(true); }} />
          </View> : role === 'participant' ? <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={loading || busy || needsJoin}
              accessibilityState={{ disabled: loading || busy || needsJoin }} onPress={() => toggleAction('leave')}
              style={({ pressed }) => [styles.outlinedButton, { borderColor: colors.rollpe_main,
                opacity: loading || busy || needsJoin ? 0.5 : pressed ? 0.7 : 1 }]}>
              <Text style={[styles.outlinedLabel, { color: colors.rollpe_main }]}>{t('participants.leave')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('info.report')} disabled={loading || busy || needsJoin}
              accessibilityState={{ disabled: loading || busy || needsJoin }}
              onPress={() => { void runAction(async () => {
                await Linking.openURL(reportRollpeUrl(code, result?.user.identifyCode ?? ''));
              }); }} style={({ pressed }) => [styles.report, { borderColor: colors.rollpe_main,
                opacity: loading || busy || needsJoin ? 0.5 : pressed ? 0.7 : 1 }]}>
              <Image source={require('@/assets/icons/icon_siren.svg')} accessible={false} contentFit="contain" style={styles.reportIcon} />
            </Pressable>
          </View> : null}
      </View>
      {role === 'receiver' && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.export}>
        <RollpePaper {...rollpe} messages={rollpe.hearts.data} width={rollpe.ratio === '세로' ? 595 : 842}
          shadow={false} paperRef={exportPaper} onReadyChange={setReady} />
      </View>}
    </>}
    {signInRequired && <AppDialog title={t('common.notice')} message={t('info.signInRequired')} confirmLabel={t('common.signIn')}
      busy={joining} onCancel={goBack} onConfirm={() => { void signIn(); }} />}
    {full && <AppDialog title={t('info.fullTitle')} message={t('info.full')} onConfirm={goBack} onClose={goBack} />}
    {entry && <RollpeEntry title={entry.title} isPublic={entry.isPublic} invited={Boolean(entry.invitationCode)} error={entryError} busy={joining}
      onSubmit={password => { void join(password); }} onCancel={goBack} />}
    {members && <ParticipantModal code={code} onClose={() => { managing.current = false; setMembers(false); setAttempt(value => value + 1); }}
      onAuthenticationRequired={authenticate} />}
    {sharing && result && role === 'host' && <ShareRollpeModal paper={result.rollpe} userId={result.user.id}
      onClose={() => { managing.current = false; setSharing(false); setAttempt(value => value + 1); }} onAuthenticationRequired={authenticate} />}
    {management && result && <RollpeManagementModal paper={result.rollpe} userId={result.user.id}
      onClose={() => { managing.current = false; setManagement(false); }}
      onReload={() => { managing.current = false; setManagement(false); setAttempt(value => value + 1); }}
      onCompleted={() => { router.dismissAll(); router.replace('/home'); }}
      onAuthenticationRequired={authenticate} />}
    {history && <HeartHistoryModal code={history} onClose={() => { managing.current = false; setHistory(null); }} onAuthenticationRequired={authenticate} />}
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
  writerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  edited: { fontFamily: RollpeFonts.display, fontSize: 16 },
  participants: { marginTop: 40, flexDirection: 'row', alignItems: 'center', gap: 4 }, chevron: { width: 20, height: 20 },
  row: { flexDirection: 'row', gap: 8 }, flexButton: { flex: 1 },
  outlinedButton: { flex: 1, borderWidth: 2, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center' },
  outlinedLabel: { fontFamily: RollpeFonts.semibold, fontSize: 16, textAlign: 'center' },
  report: { width: 52, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  reportIcon: { width: 20, height: 20 }, failure: { flex: 1, justifyContent: 'center', padding: 20, gap: 20 },
  description: { fontFamily: RollpeFonts.regular, fontSize: 16, textAlign: 'center' },
  export: { position: 'absolute', left: -10000, top: 0 },
});
