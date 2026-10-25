import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { UserList } from '@/components/ui/UserList';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { RecipientPickerContent } from '@/features/create-rollpe/components/RecipientPicker';
import { HeartDialog } from '@/features/rollpe-content/components/HeartDialog';
import { HeartHistoryContent } from '@/features/rollpe-content/components/HeartHistoryModal';
import { fetchParticipants, inviteParticipant, kickParticipant, ParticipantError } from '@/features/rollpe-info/participants';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function ParticipantModal({ code, onClose, onAuthenticationRequired }: {
  code: string; onClose: () => void; onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation(), colors = useRollpeColors(), { height } = useWindowDimensions();
  const [users, setUsers] = useState<Awaited<ReturnType<typeof fetchParticipants>>>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [picker, setPicker] = useState(false), [history, setHistory] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void; onCancel?: () => void } | null>(null);
  const active = useRef(true), pending = useRef(false), mutation = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; mutation.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchParticipants(code, controller.signal).then(value => { if (!controller.signal.aborted) setUsers(value); }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else setError(cause instanceof Error ? cause.message : t('participants.loadFailed'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [code, attempt, onAuthenticationRequired, t]);

  function reload() { setLoading(true); setError(''); setAttempt(value => value + 1); }
  function notice(message: string, after?: () => void) {
    setDialog({ message, onConfirm: () => { setDialog(null); after?.(); } });
  }
  async function change(action: (signal: AbortSignal) => Promise<void>, message: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setPicker(false); setDialog(null);
    const controller = new AbortController(); mutation.current = controller;
    try {
      await action(controller.signal);
      if (active.current) { reload(); notice(message); }
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else notice(cause instanceof Error ? cause.message : t('participants.failed'),
        cause instanceof ParticipantError && cause.reload ? () => reload() : undefined);
    } finally { pending.current = false; if (active.current) setBusy(false); }
  }
  function close() { if (!pending.current) onClose(); }

  return <AppModal visible onClose={() => {
    if (dialog) dialog.onCancel?.();
    else if (history) setHistory(null);
    else if (picker) setPicker(false);
    else close();
  }} avoidKeyboard>
    {picker ? <RecipientPickerContent title={t('participants.invite')} actionTitle={t('participants.inviteAction')} onClose={() => setPicker(false)}
      closeLabel={t('participants.closeInvite')} searchLabel={t('participants.searchUsers')}
      onError={cause => cause instanceof AuthenticationRequiredError ? onAuthenticationRequired() : notice(cause instanceof Error ? cause.message : t('participants.failed'))}
      onSelect={user => { void change(signal => inviteParticipant(code, user.id, signal), t('participants.invited', { name: user.name })); }} />
      : history ? <HeartHistoryContent code={history} onClose={() => setHistory(null)} onAuthenticationRequired={onAuthenticationRequired} /> :
      <View accessibilityViewIsModal style={[styles.content, { height: height * 0.62, backgroundColor: colors.rollpe_primary }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('participants.close')} disabled={busy} hitSlop={12} onPress={close} style={styles.close}>
          <Image source={require('@/assets/images/home/close.svg')} tintColor={colors.rollpe_secondary} accessible={false} style={StyleSheet.absoluteFill} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{t('participants.title')}</Text>
        <Pressable accessibilityRole="button" disabled={loading || busy || Boolean(error)} onPress={() => setPicker(true)}
          style={[styles.invite, { opacity: loading || busy || error ? 0.5 : 1 }]}>
          <Image source={require('@/assets/icons/user-invite.svg')} tintColor={colors.rollpe_main} style={styles.icon} accessible={false} />
          <Text style={[styles.inviteText, { color: colors.rollpe_main }]}>{t('participants.invite')}</Text>
        </Pressable>
        {error ? <View style={styles.failure}>
          <Text accessibilityRole="alert" style={[styles.description, { color: colors.rollpe_secondary }]}>{error}</Text>
          <PrimaryButton title={t('common.retry')} onPress={() => reload()} />
        </View> : <UserList users={users} loading={loading} loadingLabel={t('participants.loading')} renderDetail={user => <View style={styles.status}>
          {(user.isHost || user.isReceiver) && <Text style={[styles.description, { color: colors.rollpe_secondary }]}>{t(user.isHost ? 'participants.host' : 'participants.receiver')}</Text>}
          <Text style={[styles.description, { color: colors.rollpe_secondary }]}>{t(user.hasWritten ? 'participants.written' : 'participants.unwritten')}</Text>
          {user.revisionCount > 0 && user.heartCode && <Pressable accessibilityRole="button" accessibilityLabel={t('history.forUser', { name: user.name })}
            onPress={() => setHistory(user.heartCode)}><Text style={[styles.edited, { color: colors.rollpe_main }]}>{t('history.edited')}</Text></Pressable>}
        </View>} renderAction={user => !user.isHost && !user.isReceiver && <Pressable accessibilityRole="button"
          accessibilityLabel={t('participants.kickUser', { name: user.name })} disabled={busy} hitSlop={4} style={styles.remove}
          onPress={() => setDialog({ message: t('participants.kickConfirmation', { name: user.name }), onCancel: () => setDialog(null),
            onConfirm: () => { void change(signal => kickParticipant(code, user.id, signal), t('participants.kicked')); } })}>
          <Image source={require('@/assets/icons/user-remove.svg')} tintColor={colors.rollpe_main} style={styles.icon} accessible={false} />
        </Pressable>} />}
        {busy && <LoadingView accessibilityLabel={t('common.processing')} />}
      </View>
    }
    {dialog && <HeartDialog {...dialog} />}
  </AppModal>;
}
const styles = StyleSheet.create({
  content: { borderRadius: 16, paddingHorizontal: 20, paddingBottom: 20 },
  close: { position: 'absolute', top: 28, left: 20, width: 20, height: 20, zIndex: 1 },
  title: { marginTop: 24, fontFamily: RollpeFonts.display, fontSize: 28, textAlign: 'center' },
  invite: { marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 24, height: 24 }, inviteText: { fontFamily: RollpeFonts.display, fontSize: 20 },
  status: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, marginTop: 4 },
  description: { fontFamily: RollpeFonts.regular, fontSize: 13 }, edited: { fontFamily: RollpeFonts.regular, fontSize: 13, textDecorationLine: 'underline' },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, failure: { flex: 1, justifyContent: 'center', gap: 20 },
});
