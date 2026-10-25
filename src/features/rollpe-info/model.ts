import { t } from '@/i18n';
import { normalizeRollpeCode } from '@/utils/rollpe-link';
export { normalizeRollpeCode } from '@/utils/rollpe-link';

export type RollpeUser = { id: number; name: string; identifyCode: string };
export type RollpeHeart = {
  id: number; code: string; index: number; author: RollpeUser; content: string; color: string; revisionCount?: number;
};
export type RollpeInfo = {
  id: number; code: string; title: string; host: RollpeUser;
  receive: { receiver: RollpeUser | null; receivingDate: string; receivingStat: number };
  viewStat: boolean; ratio: string; theme: string; size: string;
  maxHeartLength: number; hearts: { count: number; data: RollpeHeart[] };
};

export function validReceivingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Roll-pe's delivery date is a Korean calendar date, with a 10 AM deadline.
export function rollpeDeadline(date: string): number {
  return validReceivingDate(date) ? Date.parse(`${date}T10:00:00+09:00`) : NaN;
}

export function remainingTime(date: string, now = Date.now()): string {
  const remaining = rollpeDeadline(date) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return t('info.closed');
  const minutes = Math.floor(remaining / 60_000);
  const values = { days: Math.floor(minutes / 1440), hours: Math.floor(minutes / 60) % 24, minutes: minutes % 60 };
  const value = t(values.days ? 'info.days' : values.hours ? 'info.hours' : 'info.minutes', values);
  return t('info.remaining', { value });
}

export function isRollpeDelivered(rollpe: RollpeInfo, now = Date.now()): boolean {
  return rollpe.receive.receivingStat === 1 || now >= rollpeDeadline(rollpe.receive.receivingDate);
}

export function rollpeRole(rollpe: RollpeInfo, userId: number, now = Date.now()) {
  if (isRollpeDelivered(rollpe, now)) {
    return rollpe.receive.receiver?.id === userId ? 'receiver' : 'unavailable';
  }
  return rollpe.host.id === userId ? 'host' : 'participant';
}

export function canDeleteRollpe(rollpe: RollpeInfo, userId: number, now = Date.now()): boolean {
  return rollpe.host.id === userId && rollpe.receive.receivingStat === 0
    && now < rollpeDeadline(rollpe.receive.receivingDate);
}

export function canSendRollpe(rollpe: RollpeInfo, userId: number, now = Date.now()): boolean {
  return canDeleteRollpe(rollpe, userId, now) && rollpe.receive.receiver !== null;
}

export type RollpeAction = 'delete' | 'send';

export function rollpeShareUrl(code: string, website?: string): string {
  const normalized = normalizeRollpeCode(code);
  if (!normalized) throw new Error(t('info.invalidCode'));
  try {
    const url = new URL(website ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return `${url.origin}/rollpe/${normalized}`;
    }
  } catch { /* With no web deployment, share the registered application scheme. */ }
  return `rollpe://rollpe/${normalized}`;
}

export function reportRollpeUrl(code: string, identifyCode: string): string {
  const normalized = normalizeRollpeCode(code);
  if (!normalized || !identifyCode) throw new Error(t('info.reportFailed'));
  const params = new URLSearchParams({ usp: 'pp_url', 'entry.44205633': '부적절한 롤페',
    'entry.2107714088': identifyCode, 'entry.1553361014': normalized, 'entry.1614951501': '해당 없음' });
  return `https://docs.google.com/forms/d/e/1FAIpQLSfBv17bitAz4mSeiPg0hgXU9FktXujQCEIYe3_m1L-y8bIWyQ/viewform?${params}`;
}
