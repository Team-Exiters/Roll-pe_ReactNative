import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { AppDialog } from '@/components/ui/AppDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { RecipientPickerContent } from '@/features/create-rollpe/components/RecipientPicker';
import type { Recipient } from '@/features/create-rollpe/validation';
import { copyRollpeLink } from '@/features/rollpe-info/copy-link';
import { isRollpeDelivered, type RollpeInfo } from '@/features/rollpe-info/model';
import { inviteParticipant, ParticipantError } from '@/features/rollpe-info/participants';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function ShareRollpeModal({ paper, userId, onClose, onAuthenticationRequired }: {
  paper: RollpeInfo; userId: number; onClose: () => void; onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation(), colors = useRollpeColors(), { height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const active = useRef(true), pending = useRef(false), request = useRef<AbortController | null>(null);
  const isHost = paper.host.id === userId;
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);

  function notice(message: string, after?: () => void) {
    setDialog({ message, onConfirm: () => { setDialog(null); after?.(); } });
  }
  function close() { if (!pending.current && !dialog) onClose(); }
  async function run(action: (signal: AbortSignal) => Promise<void>, message: string, after?: () => void) {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    try {
      await action(controller.signal);
      if (active.current) notice(message, after);
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else notice(cause instanceof Error ? cause.message : t('participants.failed'),
        cause instanceof ParticipantError && cause.reload ? onClose : undefined);
    } finally { pending.current = false; if (active.current) setBusy(false); }
  }
  function invite(user: Recipient) {
    if (!isHost) { notice(t('participants.hostOnly')); return; }
    if (isRollpeDelivered(paper)) { notice(t('info.closed'), onClose); return; }
    void run(signal => inviteParticipant(paper.code, user.id, signal), t('participants.invited', { name: user.name }), onClose);
  }
  function copy() {
    const website = process.env.EXPO_PUBLIC_WEB_URL ?? (Platform.OS === 'web' ? window.location.origin : undefined);
    void run(() => copyRollpeLink(paper.code, website), t('info.linkCopied'));
  }
  const copyButton = <Pressable accessibilityRole="button" disabled={busy} onPress={copy}
    style={[styles.copy, { borderColor: colors.rollpe_main, opacity: busy ? 0.5 : 1 }]}>
    <Text style={[styles.copyText, { color: colors.rollpe_main }]}>{t('info.copyLink')}</Text>
  </Pressable>;
  return <AppModal visible onClose={close} avoidKeyboard>
    {isHost ? <RecipientPickerContent title={t('info.share')} closeLabel={t('info.closeShare')} searchLabel={t('participants.searchUsers')}
      busy={busy} onClose={close} onSelect={invite}
      onError={cause => cause instanceof AuthenticationRequiredError ? onAuthenticationRequired() : notice(cause instanceof Error ? cause.message : t('participants.failed'))}
      renderActions={(selected, searching) => <View style={styles.actions}>
        <PrimaryButton title={t('participants.inviteAction')} style={styles.button} textStyle={styles.copyText} disabled={busy || searching || !selected || isRollpeDelivered(paper)}
          onPress={() => { if (selected) invite(selected); }} />
        {copyButton}
      </View>} />
      : <View accessibilityViewIsModal style={[styles.content, { height: height * 0.62, backgroundColor: colors.rollpe_primary }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('info.closeShare')} disabled={busy} hitSlop={12} onPress={close} style={styles.close}>
          <Image source={require('@/assets/images/home/close.svg')} tintColor={colors.rollpe_secondary} accessible={false} style={StyleSheet.absoluteFill} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.rollpe_secondary }]}>{t('info.share')}</Text>
        <View style={styles.explanation}><Text style={[styles.description, { color: colors.rollpe_secondary }]}>{t('info.inviteByLink')}</Text></View>
        <View style={styles.actions}>{copyButton}</View>
        {busy && <LoadingView accessibilityLabel={t('common.processing')} />}
      </View>}
    {dialog && <AppDialog {...dialog} />}
  </AppModal>;
}
const styles = StyleSheet.create({
  content: { borderRadius: 16, paddingHorizontal: 20, paddingBottom: 20 },
  close: { position: 'absolute', top: 28, left: 20, width: 20, height: 20, zIndex: 1 },
  title: { marginTop: 24, fontFamily: RollpeFonts.display, fontSize: 28, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8 }, button: { flex: 1 },
  copy: { flex: 1, borderWidth: 2, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center' },
  copyText: { fontFamily: RollpeFonts.display, fontSize: 16, textAlign: 'center' },
  explanation: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  description: { fontFamily: RollpeFonts.display, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
