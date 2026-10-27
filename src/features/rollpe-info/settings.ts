import { receivingDateLimits } from '@/features/create-rollpe/validation';
import { RollpeActionError } from '@/features/rollpe-info/api';
import { isRollpeDelivered, normalizeRollpeCode, validReceivingDate, type RollpeInfo } from '@/features/rollpe-info/model';
import { t } from '@/i18n';
import { AuthenticationRequiredError, authenticatedPatch } from '@/lib/authenticated-api';

export type RollpeSettings = { isPrivate: boolean; password: string; receivingDate: string };

export function settingsDateLimits(now = new Date()) {
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return receivingDateLimits(new Date(korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate()));
}

export function rollpeSettingsError(paper: RollpeInfo, values: RollpeSettings, now = new Date()): string | null {
  if (isRollpeDelivered(paper, now.getTime())) return t('settings.closed');
  if (values.isPrivate && ((!values.password && paper.viewStat) || (values.password && !values.password.trim()))) return t('create.passwordRequired');
  if (values.isPrivate && values.password.length > 50) return t('create.passwordTooLong');
  const limits = settingsDateLimits(now);
  if (!validReceivingDate(values.receivingDate) || (values.receivingDate !== paper.receive.receivingDate
    && (values.receivingDate < limits.minimum || values.receivingDate > limits.maximum))) return t('settings.invalidDate');
  return null;
}

export function settingsChanged(paper: RollpeInfo, values: RollpeSettings): boolean {
  return !values.isPrivate !== paper.viewStat || values.receivingDate !== paper.receive.receivingDate
    || values.isPrivate && Boolean(values.password);
}

export async function updateRollpeSettings(paper: RollpeInfo, userId: number, values: RollpeSettings, signal?: AbortSignal): Promise<void> {
  const pcode = normalizeRollpeCode(paper.code);
  if (!pcode || paper.host.id !== userId) throw new Error(t('settings.forbidden'));
  const error = rollpeSettingsError(paper, values);
  if (error) throw new Error(error);
  if (!settingsChanged(paper, values)) throw new Error(t('settings.unchanged'));
  let result: Awaited<ReturnType<typeof authenticatedPatch>>;
  try {
    result = await authenticatedPatch('/api/paper', {
      pcode, viewStat: !values.isPrivate, receivingDate: values.receivingDate,
      ...(values.isPrivate && values.password ? { password: values.password } : {}),
    }, signal);
  } catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new RollpeActionError('reload', t('settings.uncertain'));
  }
  const { response, payload } = result;
  if (response.status === 404) throw new RollpeActionError('missing', t('info.deleteMissing'));
  if ([403, 470, 471].includes(response.status)) throw new RollpeActionError('reload', t('settings.forbidden'));
  if (response.status === 483) throw new RollpeActionError('reload', t('settings.closed'));
  if (response.status === 400) throw new Error(t('settings.invalid'));
  const data = payload?.data;
  if (response.status !== 200 || !data || typeof data !== 'object' || Array.isArray(data)
    || normalizeRollpeCode((data as Record<string, unknown>).code) !== pcode
    || (data as Record<string, unknown>).viewStat !== !values.isPrivate
    || (data as Record<string, unknown>).receivingDate !== values.receivingDate) {
    throw new RollpeActionError('reload', t('settings.uncertain'));
  }
}
