import { isRecord, isPositiveInteger, parsePage, type ApiPage } from '@/lib/api-response';
import { rollpeDeadline, validReceivingDate } from '@/features/rollpe-info/model';
import { t } from '@/i18n';
import { AuthenticationRequiredError, authenticatedGet } from '@/lib/authenticated-api';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export const myRollpeTitles = {
  created: 'myPage.created',
  participating: 'myPage.participating',
  received: 'myPage.received',
} as const;
export type MyRollpeKind = keyof typeof myRollpeTitles;
export function isMyRollpeKind(value: unknown): value is MyRollpeKind {
  return value === 'created' || value === 'participating' || value === 'received';
}
export type MyRollpe = {
  id: number;
  code: string;
  title: string;
  theme: '화이트' | '추모' | '축하';
  isPublic: boolean;
  host: { id: number; name: string };
  receiverId: number | null;
  receivingDate: string;
  receivingStat: 0 | 1;
  createdAt: string;
};
export type MyRollpePage = ApiPage<MyRollpe>;

function parseMyRollpe(value: unknown): MyRollpe {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    !normalizeRollpeCode(value.code) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    !['화이트', '추모', '축하'].includes(value.theme as string) ||
    typeof value.viewStat !== 'boolean' ||
    !isRecord(value.host) ||
    !isPositiveInteger(value.host.id) ||
    typeof value.host.name !== 'string' ||
    !isRecord(value.receive) ||
    !validReceivingDate(value.receive.receivingDate) ||
    ![0, 1].includes(value.receive.receivingStat as number) ||
    !(
      value.receive.receiver === null ||
      (isRecord(value.receive.receiver) && isPositiveInteger(value.receive.receiver.id))
    ) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  )
    throw new Error(t('myPage.listFailed'));
  return {
    id: value.id,
    code: normalizeRollpeCode(value.code)!,
    title: value.title,
    theme: value.theme as MyRollpe['theme'],
    isPublic: value.viewStat,
    host: { id: value.host.id, name: value.host.name },
    receiverId:
      value.receive.receiver === null ? null : (value.receive.receiver as { id: number }).id,
    receivingDate: value.receive.receivingDate,
    receivingStat: value.receive.receivingStat as 0 | 1,
    createdAt: value.createdAt,
  };
}

export async function fetchMyRollpes(
  kind: MyRollpeKind,
  page = 1,
  signal?: AbortSignal,
): Promise<MyRollpePage> {
  if (!isMyRollpeKind(kind) || !Number.isSafeInteger(page) || page < 1)
    throw new Error(t('myPage.listFailed'));
  const type = { created: 'host', participating: 'participating', received: 'my' }[kind];
  const { response, payload } = await authenticatedGet(
    `/api/paper/mypage?${new URLSearchParams({ type, page: String(page) })}`,
    signal,
  ).catch((cause) => {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new Error(t('myPage.listFailed'));
  });
  const data = payload?.data;
  // Existing iOS list endpoints use [] only for an empty first page.
  if (response.ok && page === 1 && Array.isArray(data) && data.length === 0)
    return { count: 0, items: [], nextPage: null };
  if (!response.ok) throw new Error(t('myPage.listFailed'));
  return parsePage(
    data,
    page,
    parseMyRollpe,
    [(value) => value.code, (value) => value.id],
    t('myPage.listFailed'),
  );
}

export function isMyRollpeDelivered(paper: MyRollpe, now = Date.now()): boolean {
  return paper.receivingStat === 1 || now >= rollpeDeadline(paper.receivingDate);
}
export function canOpenMyRollpe(paper: MyRollpe, userId: number, now = Date.now()): boolean {
  return !isMyRollpeDelivered(paper, now) || paper.receiverId === userId;
}
