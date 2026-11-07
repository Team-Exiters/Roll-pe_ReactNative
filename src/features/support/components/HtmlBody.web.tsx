import { noticeDocument } from '@/features/support/html-document';
import { useTranslation } from '@/i18n';

export function HtmlBody({ html }: { html: string }) {
  const { t } = useTranslation();
  return (
    <iframe
      title={t('notices.body')}
      srcDoc={noticeDocument(html)}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ flex: 1, width: '100%', minHeight: 200, border: 0, background: '#FFFFFF' }}
    />
  );
}
