import { isRecord, parsePage, type ApiPage } from '@/lib/api-response';
import { validReceivingDate } from '@/features/rollpe-info/model';
import { t } from '@/i18n';
import { AuthenticationRequiredError, authenticatedGet } from '@/lib/authenticated-api';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export type SearchRollpe = {
  id: number;
  code: string;
  title: string;
  theme: '화이트' | '추모' | '축하';
  host: { name: string };
  receivingDate: string;
  createdAt: string;
};
export type SearchPage = ApiPage<SearchRollpe>;

function parseSearchRollpe(value: unknown): SearchRollpe {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.id) ||
    (value.id as number) <= 0 ||
    !normalizeRollpeCode(value.code) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.viewStat !== true ||
    !['화이트', '추모', '축하'].includes(value.theme as string) ||
    !isRecord(value.host) ||
    typeof value.host.name !== 'string' ||
    !isRecord(value.receive) ||
    !validReceivingDate(value.receive.receivingDate) ||
    value.receive.receivingStat !== 0 ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    throw new Error(t('search.failed'));
  }
  return {
    id: value.id as number,
    code: normalizeRollpeCode(value.code)!,
    title: value.title,
    theme: value.theme as SearchRollpe['theme'],
    host: { name: value.host.name },
    receivingDate: value.receive.receivingDate,
    createdAt: value.createdAt,
  };
}

export async function searchRollpes(
  keyword: string,
  page = 1,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const query = keyword.trim();
  if (!query || query.length > 100 || !Number.isSafeInteger(page) || page < 1)
    throw new Error(t('search.enterTitle'));
  const params = new URLSearchParams({ k: query, page: String(page) });
  const { response, payload } = await authenticatedGet(
    `/api/engine/search?${params}`,
    signal,
  ).catch((cause) => {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new Error(t('search.failed'));
  });
  const data = payload?.data;
  if (!response.ok) throw new Error(t('search.failed'));
  return parsePage(
    data,
    page,
    parseSearchRollpe,
    [(value) => value.code, (value) => value.id],
    t('search.failed'),
  );
}
