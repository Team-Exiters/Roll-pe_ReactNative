import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { deleteRollpe, sendRollpe, RollpeActionError } from '@/features/rollpe-info/api';
import { canDeleteRollpe, canSendRollpe, type RollpeAction, type RollpeInfo } from '@/features/rollpe-info/model';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function RollpeActionDialog({ action, paper, userId, onClose, onCompleted, onReload, onAuthenticationRequired }: {
  action: RollpeAction; paper: RollpeInfo; userId: number; onClose: () => void; onCompleted: () => void;
  onReload: () => void; onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation(), colors = useRollpeColors();
  const [stage, setStage] = useState<'confirm' | 'pending' | 'completed' | 'error'>('confirm');
  const [failure, setFailure] = useState<RollpeActionError | null>(null);
  const active = useRef(true), pending = useRef(false), request = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);

  function finish() {
    if (pending.current) return;
    if (stage === 'completed' || failure?.reason === 'missing') onCompleted();
    else if (failure) onReload();
    else onClose();
  }
  async function submit() {
    if (pending.current) return;
    if (!(action === 'delete' ? canDeleteRollpe(paper, userId) : canSendRollpe(paper, userId))) {
      setFailure(new RollpeActionError('reload', t(action === 'delete' ? 'info.deleteClosed'
        : paper.receive.receiver ? 'info.sendClosed' : 'info.sendRecipientRequired')));
      setStage('error'); return;
    }
    pending.current = true; setStage('pending');
    const controller = new AbortController(); request.current = controller;
    try {
      await (action === 'delete' ? deleteRollpe(paper.code, controller.signal) : sendRollpe(paper.code, controller.signal));
      if (active.current) setStage('completed');
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else {
        setFailure(cause instanceof RollpeActionError ? cause : new RollpeActionError('reload', t(action === 'delete' ? 'info.deleteUncertain' : 'info.sendUncertain')));
        setStage('error');
      }
    } finally { pending.current = false; }
  }
  const message = stage === 'confirm' ? t(action === 'delete' ? 'info.deleteConfirmation' : 'info.sendConfirmation',
    { title: paper.title, receiver: paper.receive.receiver?.name ?? '' })
    : stage === 'pending' ? t('common.processing') : stage === 'completed' ? t(action === 'delete' ? 'info.deleted' : 'info.sent') : failure?.message;
  return <AppModal visible onClose={finish}>
    <View role="alertdialog" aria-modal accessibilityViewIsModal
      style={[styles.dialog, { backgroundColor: colors.rollpe_primary }]}>
      <Text style={[styles.title, { color: colors.rollpe_secondary }]}>{t(action === 'delete' ? 'info.delete' : 'info.send')}</Text>
      {message && <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.rollpe_secondary }]}>{message}</Text>}
      {stage === 'pending' ? <ActivityIndicator accessibilityLabel={t('common.processing')} style={styles.spinner} color={colors.rollpe_main} />
        : <View style={styles.buttons}>
          {stage === 'confirm' && <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
            <Text style={[styles.label, { color: colors.rollpe_secondary }]}>{t('common.cancel')}</Text>
          </Pressable>}
          <Pressable accessibilityRole="button" onPress={() => {
            if (stage === 'confirm') void submit();
            else finish();
          }} style={styles.button}>
            <Text style={[styles.label, { color: colors.rollpe_main }]}>{t(stage === 'confirm'
              ? action === 'delete' ? 'info.deleteAction' : 'info.sendAction' : 'common.confirm')}</Text>
          </Pressable>
        </View>}
    </View>
  </AppModal>;
}

const styles = StyleSheet.create({
  dialog: { width: '100%', maxWidth: 360, alignSelf: 'center', padding: 20, borderRadius: 16 },
  title: { fontFamily: RollpeFonts.display, fontSize: 28, textAlign: 'center' },
  message: { fontFamily: RollpeFonts.regular, fontSize: 16, marginTop: 20, lineHeight: 24, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 20 }, button: { flex: 1, padding: 12, alignItems: 'center' },
  label: { fontFamily: RollpeFonts.semibold, fontSize: 16 }, spinner: { marginTop: 20 },
});
