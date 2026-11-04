import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { AppDialog } from '@/components/ui/AppDialog';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts } from '@/constants/theme';
import { RecipientPickerContent } from '@/features/create-rollpe/components/RecipientPicker';
import type { Recipient } from '@/features/create-rollpe/validation';
import { copyRollpeLink } from '@/features/rollpe-info/copy-link';
import { isRollpeDelivered, type RollpeInfo } from '@/features/rollpe-info/model';
import { inviteParticipant, ParticipantError } from '@/features/rollpe-info/participants';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function ShareRollpeModal({
  paper,
  userId,
  onClose,
  onAuthenticationRequired,
}: {
  paper: RollpeInfo;
  userId: number;
  onClose: () => void;
  onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const active = useRef(true),
    pending = useRef(false),
    request = useRef<AbortController | null>(null);
  const isHost = paper.host.id === userId;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);

  function notice(message: string, after?: () => void) {
    setDialog({
      message,
      onConfirm: () => {
        setDialog(null);
        after?.();
      },
    });
  }
  function close() {
    if (!pending.current && !dialog) onClose();
  }
  async function run(
    action: (signal: AbortSignal) => Promise<void>,
    message: string,
    after?: () => void,
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      await action(controller.signal);
      if (active.current) notice(message, after);
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else
        notice(
          cause instanceof Error ? cause.message : t('participants.failed'),
          cause instanceof ParticipantError && cause.reload ? onClose : undefined,
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  function invite(user: Recipient) {
    if (!isHost) {
      notice(t('participants.hostOnly'));
      return;
    }
    if (isRollpeDelivered(paper)) {
      notice(t('info.closed'), onClose);
      return;
    }
    void run(
      (signal) => inviteParticipant(paper.code, user.id, signal),
      t('participants.invited', { name: user.name }),
      onClose,
    );
  }
  function copy() {
    if (!isHost) {
      notice(t('participants.hostOnly'));
      return;
    }
    if (isRollpeDelivered(paper)) {
      notice(t('info.closed'), onClose);
      return;
    }
    const website =
      process.env.EXPO_PUBLIC_WEB_URL ??
      (Platform.OS === 'web' ? window.location.origin : undefined);
    void run(() => copyRollpeLink(paper.code, website), t('info.linkCopied'));
  }
  if (!isHost || isRollpeDelivered(paper)) return null;
  return (
    <AppModal visible onClose={close} avoidKeyboard>
      <RecipientPickerContent
        title={t('info.share')}
        closeLabel={t('info.closeShare')}
        searchLabel={t('participants.searchUsers')}
        busy={busy}
        onClose={close}
        onSelect={invite}
        onError={(cause) =>
          cause instanceof AuthenticationRequiredError
            ? onAuthenticationRequired()
            : notice(cause instanceof Error ? cause.message : t('participants.failed'))
        }
        renderActions={(selected, searching) => (
          <View style={styles.actions}>
            <PrimaryButton
              title={t('participants.inviteAction')}
              style={styles.button}
              textStyle={styles.copyText}
              disabled={busy || searching || !selected || isRollpeDelivered(paper)}
              onPress={() => {
                if (selected) invite(selected);
              }}
            />
            <OutlineButton
              title={t('info.copyLink')}
              disabled={busy}
              onPress={copy}
              style={styles.button}
              textStyle={styles.copyText}
            />
          </View>
        )}
      />
      {dialog && <AppDialog {...dialog} inline={Platform.OS === 'ios'} />}
    </AppModal>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
  copyText: { fontFamily: RollpeFonts.display, fontSize: 16, textAlign: 'center' },
});
