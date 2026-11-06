import { t } from '@/i18n';
import { isRecord } from '@/lib/api-response';
import { AuthenticationRequiredError, authenticatedPost } from '@/lib/authenticated-api';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

export const reportReasons = ['spam', 'abuse', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof reportReasons)[number];
export type ReportTarget = { type: 'paper' | 'heart'; code: string };

export async function submitContentReport(
  target: ReportTarget,
  reason: ReportReason,
  description: string,
  signal?: AbortSignal,
): Promise<string> {
  const code = normalizeRollpeCode(target.code);
  if (
    !code ||
    !['paper', 'heart'].includes(target.type) ||
    !reportReasons.includes(reason) ||
    Array.from(description.trim()).length > 500
  )
    throw new Error(t('report.invalid'));
  let result: Awaited<ReturnType<typeof authenticatedPost>>;
  try {
    result = await authenticatedPost(
      '/api/user/reports',
      {
        targetType: target.type,
        targetCode: code,
        reason,
        description: description.trim(),
      },
      signal,
    );
  } catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new Error(t('report.uncertain'));
  }
  if (
    (result.response.status === 201 || result.response.status === 200) &&
    isRecord(result.payload?.data) &&
    result.payload.data.alreadyReported === (result.response.status === 200)
  ) {
    return t(result.payload.data.alreadyReported ? 'report.alreadyReported' : 'report.completed');
  }
  if (result.response.status === 429) throw new Error(t('report.tooMany'));
  if ([403, 404, 471, 483].includes(result.response.status))
    throw new Error(t('report.unavailable'));
  if (result.response.status === 400) throw new Error(t('report.invalid'));
  throw new Error(t('report.uncertain'));
}
