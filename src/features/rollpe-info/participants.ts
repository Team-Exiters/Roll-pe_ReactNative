import { isRecord } from '@/lib/api-response';
import { t, type TranslationKey } from '@/i18n';
import { normalizeRollpeCode, type RollpeUser } from '@/features/rollpe-info/model';
import {
  AuthenticationRequiredError,
  authenticatedDelete,
  authenticatedGet,
  authenticatedPost,
} from '@/lib/authenticated-api';

export type RollpeParticipant = RollpeUser & {
  isHost: boolean;
  isReceiver: boolean;
  hasWritten: boolean;
  revisionCount: number;
  heartCode: string | null;
};
export class ParticipantError extends Error {
  constructor(
    message: string,
    public readonly reload = false,
  ) {
    super(message);
    this.name = 'ParticipantError';
  }
}
function validParticipant(value: unknown): value is RollpeParticipant {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.id) &&
    (value.id as number) > 0 &&
    typeof value.name === 'string' &&
    typeof value.identifyCode === 'string' &&
    typeof value.isHost === 'boolean' &&
    typeof value.isReceiver === 'boolean' &&
    typeof value.hasWritten === 'boolean' &&
    Number.isSafeInteger(value.revisionCount) &&
    (value.revisionCount as number) >= 0 &&
    (value.hasWritten
      ? Boolean(normalizeRollpeCode(value.heartCode))
      : value.heartCode === null && value.revisionCount === 0)
  );
}
function normalizedCode(code: string) {
  const normalized = normalizeRollpeCode(code);
  if (!normalized) throw new ParticipantError(t('info.invalidCode'), true);
  return normalized;
}
function failure(status: number, reason?: unknown) {
  const messages: Record<string, TranslationKey> = {
    blocked: 'participants.blocked',
    protected: 'participants.protected',
    hostCannotLeave: 'participants.hostCannotLeave',
    hostOnly: 'participants.hostOnly',
    userMissing: 'participants.userMissing',
    alreadyMember: 'participants.alreadyMember',
  };
  return new ParticipantError(
    t(
      status === 483
        ? 'info.closed'
        : status === 404
          ? 'participants.userMissing'
          : typeof reason === 'string' && messages[reason]
            ? messages[reason]
            : 'participants.failed',
    ),
    [403, 404, 483].includes(status),
  );
}
export async function fetchParticipants(
  code: string,
  signal?: AbortSignal,
): Promise<RollpeParticipant[]> {
  const { response, payload } = await authenticatedGet(
    `/api/paper/participants?${new URLSearchParams({ pcode: normalizedCode(code) })}`,
    signal,
  );
  if (!response.ok)
    throw failure(response.status, isRecord(payload?.data) ? payload.data.reason : undefined);
  if (
    !isRecord(payload?.data) ||
    !Array.isArray(payload.data.users) ||
    !payload.data.users.every(validParticipant) ||
    new Set(payload.data.users.map((user) => user.id)).size !== payload.data.users.length
  )
    throw new ParticipantError(t('participants.loadFailed'));
  return payload.data.users;
}
async function change(
  code: string,
  action: 'invite' | 'kick' | 'leave',
  userId?: number,
  signal?: AbortSignal,
): Promise<void> {
  const pcode = normalizedCode(code);
  if (action !== 'leave' && (!Number.isSafeInteger(userId) || userId! <= 0))
    throw new ParticipantError(t('participants.userMissing'));
  let result: Awaited<ReturnType<typeof authenticatedPost>>;
  try {
    result =
      action === 'leave'
        ? await authenticatedPost('/api/paper/leave', { pcode }, signal)
        : action === 'invite'
          ? await authenticatedPost('/api/paper/participants', { pcode, userId }, signal)
          : await authenticatedDelete('/api/paper/participants', { pcode, userId }, signal);
  } catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new ParticipantError(t('participants.uncertain'), true);
  }
  if (result.response.status !== 204)
    throw failure(
      result.response.status,
      isRecord(result.payload?.data) ? result.payload.data.reason : undefined,
    );
}
export const inviteParticipant = (code: string, userId: number, signal?: AbortSignal) =>
  change(code, 'invite', userId, signal);
export const kickParticipant = (code: string, userId: number, signal?: AbortSignal) =>
  change(code, 'kick', userId, signal);
export const leaveRollpe = (code: string, signal?: AbortSignal) =>
  change(code, 'leave', undefined, signal);
