import { t } from '@/i18n';
import { isRecord } from '@/lib/api-response';
import { AuthenticationRequiredError, authenticatedPost } from '@/lib/authenticated-api';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export const inquiryCategories = ['bug', 'suggestion', 'other'] as const;
export type InquiryCategory = (typeof inquiryCategories)[number];
export type InquiryDraft = { category: InquiryCategory | null; content: string };

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
