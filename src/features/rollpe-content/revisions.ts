import { t } from '@/i18n';
import { authenticatedGet } from '@/lib/authenticated-api';
import { normalizeHeartColor } from '@/features/rollpe-content/model';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export type HeartRevision = { number: number; content: string; color: string; recordedAt: string; baseline: boolean };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export async function fetchHeartRevisions(code: string, signal?: AbortSignal): Promise<HeartRevision[]> {
  const normalized = normalizeRollpeCode(code);
  if (!normalized) throw new Error(t('heart.notFound'));
  const { response, payload } = await authenticatedGet(`/api/heart/revisions?${new URLSearchParams({ hcode: normalized })}`, signal);
  if (response.status === 403) throw new Error(t('history.forbidden'));
  if (response.status === 404) throw new Error(t('heart.notFound'));
  const data = payload?.data;
  if (!response.ok || !record(data) || normalizeRollpeCode(data.heartCode) !== normalized
    || !Array.isArray(data.revisions) || !data.revisions.length) throw new Error(t('history.failed'));
  // Accept the previous order while deployed servers are being updated.
  const count = data.revisions.length;
  const ascending = record(data.revisions[0]) && data.revisions[0].number === 0;
  const revisions = data.revisions.map((value, index) => {
    const number = ascending ? index : count - 1 - index;
    if (!record(value) || value.number !== number || typeof value.content !== 'string'
      || !normalizeHeartColor(value.color) || typeof value.recordedAt !== 'string' || !Number.isFinite(Date.parse(value.recordedAt))
      || typeof value.baseline !== 'boolean') throw new Error(t('history.failed'));
    return { number, content: value.content, color: normalizeHeartColor(value.color)!, recordedAt: value.recordedAt, baseline: value.baseline };
  });
  return ascending ? revisions.reverse() : revisions;
}
