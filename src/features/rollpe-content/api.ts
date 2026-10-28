import { t, type TranslationKey } from '@/i18n';
import { AuthenticationRequiredError, authenticatedDelete, authenticatedGet, authenticatedPatch, authenticatedPost } from '@/lib/authenticated-api';
import { heartDraftError, normalizeHeartColor, type HeartColor, type HeartDraft } from '@/features/rollpe-content/model';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export class HeartMutationError extends Error {
  constructor(message: string, public readonly reload = false) { super(message); this.name = 'HeartMutationError'; }
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;

export async function fetchHeartColors(monochrome: boolean, signal?: AbortSignal): Promise<HeartColor[]> {
  const type = monochrome ? 'MONOCOLOR' : 'COLOR';
  const { response, payload } = await authenticatedGet(`/api/index?type=${type.toLowerCase()}`, signal);
  if (!response.ok || !Array.isArray(payload?.data) || !payload.data.length) throw new Error(t('heart.colorsFailed'));
  const colors = payload.data.map(value => {
    if (!record(value) || typeof value.id !== 'number' || !positive(value.id) || value.type !== type
      || !normalizeHeartColor(value.name)) throw new Error(t('heart.colorsFailed'));
    return { id: value.id, name: value.name as string, value: normalizeHeartColor(value.name)! };
  });
  if (new Set(colors.map(value => value.value)).size !== colors.length) throw new Error(t('heart.colorsFailed'));
  return colors;
}

async function mutate(action: () => ReturnType<typeof authenticatedPost>, expected: number, fallback: TranslationKey, signal?: AbortSignal): Promise<string> {
  let result: Awaited<ReturnType<typeof authenticatedPost>>;
  try { result = await action(); }
  catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    // After sending a mutation, a lost reply does not mean the server rolled it back.
    throw new HeartMutationError(t('heart.uncertainResult'), true);
  }
  const { response, payload } = result;
  if (response.status !== expected) {
    if (response.status === 409 && record(payload?.data) && payload.data.reason === 'full') {
      throw new HeartMutationError(t('info.full'), true);
    }
    const messages: Record<number, TranslationKey> = {
      403: 'info.unavailable', 470: 'heart.noDeletePermission', 471: 'info.joinRequired', 481: 'heart.noEditPermission',
      482: 'heart.alreadyWritten', 483: 'info.closed', 485: 'heart.slotTaken', 404: 'heart.notFound',
    };
    const message = messages[response.status];
    throw new HeartMutationError(message ? t(message) : typeof payload?.message === 'string' ? payload.message : t('heart.failed'),
      [403, 404, 470, 471, 481, 482, 483, 485].includes(response.status));
  }
  if (expected !== 204 && (!record(payload?.data) || !positive(payload.data.id as number)
    || !normalizeRollpeCode(payload.data.code))) throw new HeartMutationError(t('heart.uncertainResult'), true);
  return typeof payload?.message === 'string' ? payload.message : t(fallback);
}

export function saveHeart(paperId: number, index: number, draft: HeartDraft, heartId?: number, signal?: AbortSignal): Promise<string> {
  const error = heartDraftError(draft);
  if (error || !positive(paperId) || !Number.isInteger(index) || index < 0 || index >= 12 || (heartId !== undefined && !positive(heartId))) {
    return Promise.reject(new HeartMutationError(error ?? t('common.checkInput')));
  }
  const body = { paperFK: paperId, location: index, context: draft.content,
    color: normalizeHeartColor(draft.color)!.slice(1), ...(heartId === undefined ? {} : { heartPK: heartId }) };
  return mutate(() => heartId === undefined ? authenticatedPost('/api/heart', body, signal) : authenticatedPatch('/api/heart', body, signal),
    heartId === undefined ? 201 : 200, heartId === undefined ? 'heart.created' : 'heart.updated', signal);
}

export function deleteHeart(code: string, signal?: AbortSignal): Promise<string> {
  const normalized = normalizeRollpeCode(code);
  if (!normalized) return Promise.reject(new HeartMutationError(t('heart.notFound')));
  return mutate(() => authenticatedDelete(`/api/heart?${new URLSearchParams({ hcode: normalized })}`, undefined, signal), 204, 'heart.deleted', signal);
}
