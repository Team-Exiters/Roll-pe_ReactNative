import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { RollpeListItem } from '@/components/rollpe/RollpeListItem';
import { AppDialog } from '@/components/ui/AppDialog';
import { BackButton } from '@/components/ui/BackButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { dDay } from '@/features/home/api';
import { fetchInvitations, respondToInvitation, type InvitationPage, type RollpeInvitation } from '@/features/invitations/api';
import { useSafeAreaSpacing } from '@/hooks/useSafeAreaSpacing';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

type Decision = { invitation: RollpeInvitation; action: 'accept' | 'deny' };

export default function InvitationsScreen() {
  const { t } = useTranslation(), colors = useRollpeColors(), safeArea = useSafeAreaSpacing(), router = useRouter();
  const [result, setResult] = useState<InvitationPage | null>(null), [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [moreError, setMoreError] = useState(''), [notice, setNotice] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const request = useRef<AbortController | null>(null), pending = useRef(false);

  useFocusEffect(useCallback(() => {
    if (attempt > 0) setNotice('');
    const controller = new AbortController(); request.current = controller; pending.current = true;
    setLoading(true); setLoadingMore(false); setBusy(false); setError(''); setMoreError(''); setResult(null); setDecision(null);
    void (async () => {
      try {
        const page = await fetchInvitations(1, controller.signal);
        if (!controller.signal.aborted) setResult(page);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof AuthenticationRequiredError) router.replace('/sign-in');
        else setError(t('invitations.loadFailed'));
      } finally { if (!controller.signal.aborted) { pending.current = false; setLoading(false); } }
    })();
    return () => { controller.abort(); request.current?.abort(); pending.current = false; };
  }, [attempt, router, t]));

  async function more() {
    if (pending.current || !result?.nextPage) return;
    pending.current = true; setLoadingMore(true); setMoreError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const page = await fetchInvitations(result.nextPage, controller.signal);
      if (!controller.signal.aborted) setResult(current => {
        if (!current) return current;
        const codes = new Set(current.items.map(item => item.invitationCode));
        return { ...page, items: [...current.items, ...page.items.filter(item => !codes.has(item.invitationCode))] };
      });
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) router.replace('/sign-in');
      else setMoreError(t('invitations.loadFailed'));
    } finally { if (!controller.signal.aborted) { pending.current = false; setLoadingMore(false); } }
  }
  async function respond() {
    if (!decision || pending.current) return;
    const { invitation, action } = decision;
    pending.current = true; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    try {
      await respondToInvitation(invitation.invitationCode, action, controller.signal);
      if (controller.signal.aborted) return;
      setDecision(null);
      setResult(current => current && { ...current, count: Math.max(0, current.count - 1), items: current.items.filter(item => item.invitationCode !== invitation.invitationCode) });
      if (action === 'accept') router.push({ pathname: '/rollpe/[code]', params: { code: invitation.code } });
      else setAttempt(value => value + 1);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setDecision(null);
      if (cause instanceof AuthenticationRequiredError) router.replace('/sign-in');
      else setNotice(cause instanceof Error ? cause.message : t('invitations.uncertain'));
    } finally { if (!controller.signal.aborted) { pending.current = false; setBusy(false); } }
  }

  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary, paddingTop: safeArea('top') }]}>
    <View style={styles.navigation}>
      <BackButton onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }} style={styles.back} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.goHome')} onPress={() => router.dismissTo('/home')}>
        <Image source={require('@/assets/images/welcome/logo.png')} accessible={false} contentFit="contain" style={styles.logo} />
      </Pressable>
    </View>
    <FlatList data={result?.items ?? []} keyExtractor={item => item.invitationCode} style={styles.list}
      contentContainerStyle={[styles.contents, { paddingBottom: safeArea('bottom', 40) }]} showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      ListHeaderComponent={<View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{t('invitations.title')}</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.count, { color: colors.rollpe_secondary }]}>{result ? t('invitations.count', { count: result.count }) : ''}</Text>
      </View>}
      renderItem={({ item }) => <View style={styles.item}>
        <RollpeListItem title={item.title} theme={item.theme} deadline={dDay(item.receivingDate)}
          description={t('invitations.fromHost', { name: item.host.name })} />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('invitations.denyLabel', { title: item.title })} disabled={loadingMore || busy}
            onPress={() => setDecision({ invitation: item, action: 'deny' })} style={[styles.deny, { borderColor: colors.rollpe_main }]}>
            <Text style={[styles.buttonText, { color: colors.rollpe_main }]}>{t('invitations.deny')}</Text>
          </Pressable>
          <PrimaryButton title={t('invitations.accept')} accessibilityLabel={t('invitations.acceptLabel', { title: item.title })}
            textStyle={styles.buttonText} style={styles.button} disabled={loadingMore || busy} onPress={() => setDecision({ invitation: item, action: 'accept' })} />
        </View>
      </View>}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.rollpe_gray }]} />}
      ListEmptyComponent={<View style={styles.empty}>
        {loading ? <ActivityIndicator color={colors.rollpe_main} accessibilityLabel={t('invitations.loading')} /> : <>
          <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.message, { color: colors.rollpe_secondary }]}>{error || t('invitations.empty')}</Text>
          {Boolean(error) && <PrimaryButton title={t('common.retry')} onPress={() => setAttempt(value => value + 1)} />}
        </>}
      </View>}
      ListFooterComponent={result?.nextPage ? <View style={styles.footer}>
        {Boolean(moreError) && <Text accessibilityRole="alert" style={[styles.message, { color: colors.rollpe_main }]}>{moreError}</Text>}
        <PrimaryButton title={t(moreError ? 'common.retry' : 'search.more')} textStyle={styles.buttonText} disabled={loadingMore || busy} onPress={() => { void more(); }} />
        {loadingMore && <ActivityIndicator accessibilityLabel={t('invitations.loading')} color={colors.rollpe_main} />}
      </View> : undefined} />
    {decision && <AppDialog title={t('invitations.title')} busy={busy}
      message={t(decision.action === 'accept' ? 'invitations.confirmAccept' : 'invitations.confirmDeny', { title: decision.invitation.title })}
      confirmLabel={t(decision.action === 'accept' ? 'invitations.accept' : 'invitations.deny')}
      onCancel={() => setDecision(null)} onConfirm={() => { void respond(); }} />}
    {Boolean(notice) && <AppDialog message={notice} onConfirm={() => { setNotice(''); setAttempt(value => value + 1); }} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, navigation: { height: 68, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 0, top: 23.5 }, logo: { width: 48, height: 24 }, list: { marginHorizontal: 20 },
  contents: { flexGrow: 1 }, title: { marginTop: 8, fontFamily: RollpeFonts.display, fontSize: 32, textAlign: 'center' },
  count: { marginTop: 32, fontFamily: RollpeFonts.display, fontSize: 20 }, item: { paddingBottom: 20 },
  separator: { height: 2, borderRadius: 1 }, actions: { flexDirection: 'row', gap: 8 }, button: { flex: 1 },
  deny: { flex: 1, borderWidth: 2, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: RollpeFonts.display, fontSize: 16, textAlign: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, paddingVertical: 40 },
  message: { fontFamily: RollpeFonts.display, fontSize: 20, textAlign: 'center' }, footer: { paddingTop: 32, gap: 20 },
});
