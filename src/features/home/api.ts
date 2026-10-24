import { t } from '@/i18n';
import { authenticatedGet } from '@/lib/authenticated-api';

export type HomeStatus = { host: number; heart: number };
export type HotRollpe = {
  id: number; code: string; title: string; theme: string; viewStat?: boolean;
  host: { name: string };
  receive: { receivingDate: string };
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function receivingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isHotRollpe(value: unknown): value is HotRollpe {
  return record(value) && Number.isSafeInteger(value.id) && typeof value.code === 'string' && Boolean(value.code)
    && typeof value.title === 'string' && typeof value.theme === 'string'
    && (value.viewStat === undefined || typeof value.viewStat === 'boolean')
    && record(value.host) && typeof value.host.name === 'string'
    && record(value.receive) && receivingDate(value.receive.receivingDate);
}

export async function fetchHomeStatus(signal: AbortSignal): Promise<HomeStatus> {
  const { response, payload } = await authenticatedGet('/api/paper/mypage?type=main', signal);
  const data = payload?.data;
  if (!response.ok || !record(data) || !Number.isSafeInteger(data.host) || (data.host as number) < 0
    || !Number.isSafeInteger(data.heart) || (data.heart as number) < 0) {
    throw new Error(t('home.statusFailed'));
  }
  return { host: data.host as number, heart: data.heart as number };
}

export async function fetchHotRollpes(signal: AbortSignal): Promise<HotRollpe[]> {
  const { response, payload } = await authenticatedGet('/api/paper/user?type=hot', signal);
  const data = payload?.data;
  if (!response.ok || !Array.isArray(data) || !data.every(isHotRollpe)) {
    throw new Error(t('home.rollpesFailed'));
  }
  return data;
}

// The iOS app counts complete calendar days from the current time to local midnight.
export function dDay(value: string, now = new Date()): string {
  const [year, month, day] = value.split('-').map(Number);
  const calendarDays = Math.round((Date.UTC(year, month - 1, day)
    - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
  const difference = calendarDays > 0 && (now.getHours() || now.getMinutes() || now.getSeconds() || now.getMilliseconds())
    ? calendarDays - 1 : calendarDays;
  return difference === 0 ? t('home.dDay') : difference > 0 ? t('home.daysLeft', { count: difference }) : t('home.closed');
}
