import { t } from '@/i18n';
import { apiUrl, requestJson } from '@/lib/api';
import { isPositiveInteger, isRecord, parsePage } from '@/lib/api-response';
import { AuthenticationRequiredError, authenticatedPost } from '@/lib/authenticated-api';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export const inquiryCategories = ['bug', 'suggestion', 'other'] as const;
export type InquiryCategory = (typeof inquiryCategories)[number];
export type InquiryDraft = { category: InquiryCategory | null; content: string };
export type NoticeSummary = { id: number; title: string; publishedAt: string };
export type Notice = NoticeSummary & { body: string };

export function inquiryError(draft: InquiryDraft): string | null {
  if (!draft.category || !inquiryCategories.includes(draft.category))
    return t('support.selectCategory');
  if (!draft.content.trim() || draft.content.length > 2000) return t('support.enterContent');
  return null;
}

export async function sendInquiry(draft: InquiryDraft, requestId: string, signal?: AbortSignal) {
  const error = inquiryError(draft);
  if (error || !normalizeRollpeCode(requestId)) throw new Error(error ?? t('common.invalidInput'));
  let result;
  try {
    result = await authenticatedPost(
      '/api/engine/inquiries',
      {
        requestId,
        category: draft.category,
        content: draft.content.trim(),
      },
      signal,
    );
  } catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new Error(t('support.uncertain'));
  }
  if (
    [200, 201].includes(result.response.status) &&
    isRecord(result.payload?.data) &&
    result.payload.data.received === true
  )
    return;
  if (result.response.status === 400) throw new Error(t('support.invalid'));
  if (result.response.status === 429) throw new Error(t('support.tooMany'));
  throw new Error(t('support.uncertain'));
}

function noticeSummary(value: unknown): NoticeSummary {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    typeof value.publishedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.publishedAt))
  )
    throw new Error(t('notices.failed'));
  return { id: value.id, title: value.title, publishedAt: value.publishedAt };
}

export async function fetchNotices(page = 1, signal?: AbortSignal) {
  if (!apiUrl || !isPositiveInteger(page)) throw new Error(t('notices.failed'));
  const { response, payload } = await requestJson(
    '/api/engine/notices?page=' + page,
    undefined,
    'GET',
    signal,
  );
  if (!response.ok) throw new Error(t('notices.failed'));
  return parsePage(payload?.data, page, noticeSummary, [(item) => item.id], t('notices.failed'));
}

export async function fetchNotice(id: number, signal?: AbortSignal): Promise<Notice> {
  if (!apiUrl || !isPositiveInteger(id)) throw new Error(t('notices.unavailable'));
  const { response, payload } = await requestJson(
    '/api/engine/notices/' + id,
    undefined,
    'GET',
    signal,
  );
  if (response.status === 404) throw new Error(t('notices.unavailable'));
  if (!response.ok) throw new Error(t('notices.failed'));
  const summary = noticeSummary(payload?.data);
  if (
    summary.id !== id ||
    !isRecord(payload?.data) ||
    typeof payload.data.body !== 'string' ||
    !payload.data.body.trim()
  )
    throw new Error(t('notices.failed'));
  return { ...summary, body: payload.data.body };
}
