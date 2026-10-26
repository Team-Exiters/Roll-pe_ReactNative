import { validReceivingDate } from '@/features/rollpe-info/model';
import { t } from '@/i18n';
import { AuthenticationRequiredError, authenticatedGet } from '@/lib/authenticated-api';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export type SearchRollpe = {
  id: number; code: string; title: string; theme: '화이트' | '추모' | '축하';
  host: { name: string }; receivingDate: string; createdAt: string;
};
export type SearchPage = { count: number; items: SearchRollpe[]; nextPage: number | null };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function item(value: unknown): SearchRollpe {
  if (!record(value) || !Number.isSafeInteger(value.id) || (value.id as number) <= 0 || !normalizeRollpeCode(value.code)
    || typeof value.title !== 'string' || !value.title.trim() || value.viewStat !== true
    || !['화이트', '추모', '축하'].includes(value.theme as string) || !record(value.host) || typeof value.host.name !== 'string'
    || !record(value.receive) || !validReceivingDate(value.receive.receivingDate) || value.receive.receivingStat !== 0
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new Error(t('search.failed'));
  }
  return { id: value.id as number, code: normalizeRollpeCode(value.code)!, title: value.title, theme: value.theme as SearchRollpe['theme'],
    host: { name: value.host.name }, receivingDate: value.receive.receivingDate, createdAt: value.createdAt };
}

export async function searchRollpes(keyword: string, page = 1, signal?: AbortSignal): Promise<SearchPage> {
  const query = keyword.trim();
  if (!query || query.length > 100 || !Number.isSafeInteger(page) || page < 1) throw new Error(t('search.enterTitle'));
  const params = new URLSearchParams({ k: query, page: String(page) });
  const { response, payload } = await authenticatedGet(`/api/engine/search?${params}`, signal).catch(cause => {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new Error(t('search.failed'));
  });
  const data = payload?.data;
  if (!response.ok || !record(data) || !Number.isSafeInteger(data.count) || (data.count as number) < 0
    || !Array.isArray(data.results) || (data.count as number) < data.results.length
    || !(data.next === null || (typeof data.next === 'string' && Boolean(data.next)))
    || (data.next !== null && !data.results.length)) throw new Error(t('search.failed'));
  const items = data.results.map(item);
  if (new Set(items.map(value => value.code)).size !== items.length || new Set(items.map(value => value.id)).size !== items.length) {
    throw new Error(t('search.failed'));
  }
  // Only use the presence of another page. Never forward JWTs to a server-supplied URL.
  return { count: data.count as number, items, nextPage: data.next === null ? null : page + 1 };
}
