import { normalizeRollpeCode, validReceivingDate } from '@/features/rollpe-info/model';
import { t } from '@/i18n';
import { AuthenticationRequiredError, authenticatedGet, authenticatedPost } from '@/lib/authenticated-api';

export type RollpeInvitation = {
  invitationCode: string; code: string; title: string; theme: '화이트' | '추모' | '축하';
  host: { name: string }; receivingDate: string; sentAt: string; isPublic: boolean;
};
export type InvitationPage = { count: number; items: RollpeInvitation[]; nextPage: number | null };
export class InvitationError extends Error {
  constructor(message: string) { super(message); this.name = 'InvitationError'; }
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function invitation(value: unknown): RollpeInvitation {
  if (!record(value) || !normalizeRollpeCode(value.invitationCode) || !normalizeRollpeCode(value.code)
    || typeof value.title !== 'string' || !value.title.trim() || !['화이트', '추모', '축하'].includes(value.theme as string)
    || !record(value.host) || typeof value.host.name !== 'string' || !validReceivingDate(value.receivingDate)
    || typeof value.sentAt !== 'string' || !Number.isFinite(Date.parse(value.sentAt)) || typeof value.isPublic !== 'boolean') {
    throw new Error(t('invitations.loadFailed'));
  }
  return { invitationCode: normalizeRollpeCode(value.invitationCode)!, code: normalizeRollpeCode(value.code)!,
    title: value.title, theme: value.theme as RollpeInvitation['theme'], host: { name: value.host.name },
    receivingDate: value.receivingDate, sentAt: value.sentAt, isPublic: value.isPublic };
}
export async function fetchInvitations(page = 1, signal?: AbortSignal): Promise<InvitationPage> {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error(t('invitations.loadFailed'));
  const { response, payload } = await authenticatedGet(`/api/paper/invitations?page=${page}`, signal).catch(cause => {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new Error(t('invitations.loadFailed'));
  });
  const data = payload?.data;
  if (!response.ok || !record(data) || !Number.isSafeInteger(data.count) || (data.count as number) < 0
    || !Array.isArray(data.results) || (data.count as number) < data.results.length
    || !(data.next === null || (typeof data.next === 'string' && Boolean(data.next)))
    || (data.next !== null && !data.results.length)) throw new Error(t('invitations.loadFailed'));
  const items = data.results.map(invitation);
  if (new Set(items.map(item => item.invitationCode)).size !== items.length || new Set(items.map(item => item.code)).size !== items.length) {
    throw new Error(t('invitations.loadFailed'));
  }
  return { count: data.count as number, items, nextPage: data.next === null ? null : page + 1 };
}
export async function respondToInvitation(code: string, action: 'accept' | 'deny', signal?: AbortSignal): Promise<void> {
  const invitationCode = normalizeRollpeCode(code);
  if (!invitationCode || !['accept', 'deny'].includes(action)) throw new InvitationError(t('invitations.unavailable'));
  let result: Awaited<ReturnType<typeof authenticatedPost>>;
  try { result = await authenticatedPost('/api/paper/invitations', { invitationCode, action }, signal); }
  catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    // A lost reply may follow a successful write. Reload before offering another decision.
    throw new InvitationError(t('invitations.uncertain'));
  }
  if (result.response.status === 204) return;
  throw new InvitationError(t([403, 404, 409, 483].includes(result.response.status) ? 'invitations.unavailable' : 'invitations.uncertain'));
}
