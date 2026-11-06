import { t } from '@/i18n';

export type HeartColor = { id: number; name: string; value: string };
export type HeartDraft = { content: string; color: string };

export function normalizeHeartColor(value: unknown): string | null {
  return typeof value === 'string' && /^#?[a-f0-9]{6}$/i.test(value)
    ? `#${value.replace(/^#/, '').toUpperCase()}`
    : null;
}

export function cleanHeartContent(value: string): string {
  return Array.from(value.replace(/[\r\n]/g, ''))
    .slice(0, 40)
    .join('');
}

export function heartDraftError({ content, color }: HeartDraft): string | null {
  if (!content.trim()) return t('heart.enterContent');
  if (/[\r\n]/.test(content) || Array.from(content).length > 40) return t('heart.contentTooLong');
  if (!normalizeHeartColor(color)) return t('heart.selectColor');
  return null;
}
