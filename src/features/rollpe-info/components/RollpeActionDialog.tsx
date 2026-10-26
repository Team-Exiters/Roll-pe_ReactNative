import { useEffect, useRef, useState } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import { deleteRollpe, sendRollpe, RollpeActionError } from '@/features/rollpe-info/api';
import { canDeleteRollpe, canSendRollpe, isRollpeDelivered, type RollpeAction, type RollpeInfo } from '@/features/rollpe-info/model';
import { leaveRollpe, ParticipantError } from '@/features/rollpe-info/participants';
import { useTranslation } from '@/i18n';
import { AuthenticationRequiredError } from '@/lib/authenticated-api';

export function RollpeActionDialog({ action, paper, userId, onClose, onCompleted, onReload, onAuthenticationRequired }: {
  action: RollpeAction | 'leave'; paper: RollpeInfo; userId: number; onClose: () => void; onCompleted: () => void;
  onReload: () => void; onAuthenticationRequired: () => void;
}) {
  const { t } = useTranslation();
  const labels = {
    delete: { title: 'info.delete', action: 'info.deleteAction', confirmation: 'info.deleteConfirmation', completed: 'info.deleted', uncertain: 'info.deleteUncertain' },
    send: { title: 'info.send', action: 'info.sendAction', confirmation: 'info.sendConfirmation', completed: 'info.sent', uncertain: 'info.sendUncertain' },
    leave: { title: 'participants.leave', action: 'participants.leave', confirmation: 'participants.leaveConfirmation', completed: 'participants.left', uncertain: 'participants.uncertain' },
  } as const;
  const label = labels[action];
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
    if (!(action === 'leave' ? paper.host.id !== userId && !isRollpeDelivered(paper)
      : action === 'delete' ? canDeleteRollpe(paper, userId) : canSendRollpe(paper, userId))) {
      setFailure(new RollpeActionError('reload', t(action === 'leave' ? 'info.closed' : action === 'delete' ? 'info.deleteClosed'
        : paper.receive.receiver ? 'info.sendClosed' : 'info.sendRecipientRequired')));
      setStage('error'); return;
    }
    pending.current = true; setStage('pending');
    const controller = new AbortController(); request.current = controller;
    try {
      await (action === 'leave' ? leaveRollpe(paper.code, controller.signal)
        : action === 'delete' ? deleteRollpe(paper.code, controller.signal) : sendRollpe(paper.code, controller.signal));
      if (active.current) setStage('completed');
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof AuthenticationRequiredError) onAuthenticationRequired();
      else {
        setFailure(cause instanceof RollpeActionError ? cause : new RollpeActionError('reload', cause instanceof ParticipantError ? cause.message : t(label.uncertain)));
        setStage('error');
      }
    } finally { pending.current = false; }
  }
  const message = stage === 'confirm' ? t(label.confirmation,
    { title: paper.title, receiver: paper.receive.receiver?.name ?? '' })
    : stage === 'pending' ? t('common.processing') : stage === 'completed' ? t(label.completed) : failure?.message;
  return <AppDialog title={t(label.title)} message={message} busy={stage === 'pending'}
    confirmLabel={t(stage === 'confirm' ? label.action : 'common.confirm')}
    onCancel={stage === 'confirm' ? onClose : undefined} onClose={finish}
    onConfirm={() => { if (stage === 'confirm') void submit(); else finish(); }} />;
}
