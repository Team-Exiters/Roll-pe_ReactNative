import { t } from '@/i18n';
import { normalizeRollpeCode } from '@/utils/rollpe-link';

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

export function reportHeartUrl(paperCode: string, heartCode: string, identifyCode: string): string {
  const paper = normalizeRollpeCode(paperCode),
    heart = normalizeRollpeCode(heartCode);
  if (!paper || !heart || !identifyCode) throw new Error(t('info.reportFailed'));
  const params = new URLSearchParams({
    usp: 'pp_url',
    'entry.44205633': '부적절한 마음',
    'entry.2107714088': identifyCode,
    'entry.1553361014': paper,
    'entry.1614951501': heart,
  });
  return `https://docs.google.com/forms/d/e/1FAIpQLSfBv17bitAz4mSeiPg0hgXU9FktXujQCEIYe3_m1L-y8bIWyQ/viewform?${params}`;
}
