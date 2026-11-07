import { isRecord, isPositiveInteger, parsePage, type ApiPage } from '@/lib/api-response';
import { authenticatedDelete, authenticatedGet, authenticatedPost } from '@/lib/authenticated-api';
import { t } from '@/i18n';

export type BlockedUser = { id: number; name: string; identifyCode: string };
export type BlockedUserPage = ApiPage<BlockedUser>;

export async function fetchBlockedUsers(page = 1, signal?: AbortSignal): Promise<BlockedUserPage> {
  if (!isPositiveInteger(page)) throw new Error(t('blocking.loadFailed'));
  const { response, payload } = await authenticatedGet(`/api/user/blocks?page=${page}`, signal);
  if (!response.ok) throw new Error(t('blocking.loadFailed'));
  return parsePage(
    payload?.data,
    page,
    (value) => {
      if (
        !isRecord(value) ||
        !isPositiveInteger(value.id) ||
        typeof value.name !== 'string' ||
        !(value.identifyCode === null || typeof value.identifyCode === 'string')
      )
        throw new Error(t('blocking.loadFailed'));
      return { id: value.id, name: value.name, identifyCode: value.identifyCode ?? '' };
    },
    [(value) => value.id],
    t('blocking.loadFailed'),
  );
}

export async function changeUserBlock(
  userId: number,
  blocking: boolean,
  signal?: AbortSignal,
): Promise<void> {
  if (!isPositiveInteger(userId)) throw new Error(t('blocking.failed'));
  const { response } = await (blocking ? authenticatedPost : authenticatedDelete)(
    '/api/user/blocks',
    { userId },
    signal,
  );
  if (response.status !== 204) throw new Error(t('blocking.failed'));
}
