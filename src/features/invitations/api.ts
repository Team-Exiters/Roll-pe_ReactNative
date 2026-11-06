import { isRecord, parsePage, type ApiPage } from '@/lib/api-response';
import { normalizeRollpeCode, validReceivingDate } from '@/features/rollpe-info/model';
import { t } from '@/i18n';
import {
  AuthenticationRequiredError,
  authenticatedGet,
  authenticatedPost,
} from '@/lib/authenticated-api';

export type RollpeInvitation = {
  invitationCode: string;
  code: string;
  title: string;
  theme: '화이트' | '추모' | '축하';
  host: { name: string };
  receivingDate: string;
  sentAt: string;
  isPublic: boolean;
};
export type InvitationPage = ApiPage<RollpeInvitation>;
export class InvitationError extends Error {
  constructor(
    message: string,
    public readonly reason: 'full' | 'unavailable' | 'uncertain' = 'uncertain',
  ) {
    super(message);
    this.name = 'InvitationError';
  }
}
function parseInvitation(value: unknown): RollpeInvitation {
  if (
    !isRecord(value) ||
    !normalizeRollpeCode(value.invitationCode) ||
    !normalizeRollpeCode(value.code) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    !['화이트', '추모', '축하'].includes(value.theme as string) ||
    !isRecord(value.host) ||
    typeof value.host.name !== 'string' ||
    !validReceivingDate(value.receivingDate) ||
    typeof value.sentAt !== 'string' ||
    !Number.isFinite(Date.parse(value.sentAt)) ||
    typeof value.isPublic !== 'boolean'
  ) {
    throw new Error(t('invitations.loadFailed'));
  }
  return {
    invitationCode: normalizeRollpeCode(value.invitationCode)!,
    code: normalizeRollpeCode(value.code)!,
    title: value.title,
    theme: value.theme as RollpeInvitation['theme'],
    host: { name: value.host.name },
    receivingDate: value.receivingDate,
    sentAt: value.sentAt,
    isPublic: value.isPublic,
  };
}
export async function fetchInvitations(page = 1, signal?: AbortSignal): Promise<InvitationPage> {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error(t('invitations.loadFailed'));
  const { response, payload } = await authenticatedGet(
    `/api/paper/invitations?page=${page}`,
    signal,
  ).catch((cause) => {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new Error(t('invitations.loadFailed'));
  });
  const data = payload?.data;
  if (!response.ok) throw new Error(t('invitations.loadFailed'));
  return parsePage(
    data,
    page,
    parseInvitation,
    [(value) => value.invitationCode, (value) => value.code],
    t('invitations.loadFailed'),
  );
}
export async function respondToInvitation(
  code: string,
  action: 'accept' | 'deny',
  signal?: AbortSignal,
): Promise<void> {
  const invitationCode = normalizeRollpeCode(code);
  if (!invitationCode || !['accept', 'deny'].includes(action))
    throw new InvitationError(t('invitations.unavailable'));
  let result: Awaited<ReturnType<typeof authenticatedPost>>;
  try {
    result = await authenticatedPost('/api/paper/invitations', { invitationCode, action }, signal);
  } catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    // A lost reply may follow a successful write. Reload before offering another decision.
    throw new InvitationError(t('invitations.uncertain'));
  }
  if (result.response.status === 204) return;
  if (
    result.response.status === 409 &&
    isRecord(result.payload?.data) &&
    result.payload.data.reason === 'full'
  ) {
    throw new InvitationError(t('info.full'), 'full');
  }
  const unavailable = [403, 404, 409, 483].includes(result.response.status);
  throw new InvitationError(
    t(unavailable ? 'invitations.unavailable' : 'invitations.uncertain'),
    unavailable ? 'unavailable' : 'uncertain',
  );
}
