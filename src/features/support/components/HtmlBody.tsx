import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { AppDialog } from '@/components/ui/AppDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RollpeFonts } from '@/constants/theme';
import { noticeDocument, noticeLink } from '@/features/support/html-document';
import { useTranslation } from '@/i18n';

export function HtmlBody({ html }: { html: string }) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <View style={styles.body}>
      {error ? (
        <View style={styles.failure}>
          <Text style={styles.text}>{t('notices.failed')}</Text>
          <PrimaryButton
            title={t('common.retry')}
            onPress={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          />
        </View>
      ) : (
        <WebView
          key={attempt}
          source={{ html: noticeDocument(html) }}
          originWhitelist={['*']}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          style={styles.body}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url === 'about:blank') return true;
            const url = noticeLink(request.url);
            if (url) void Linking.openURL(url).catch(() => setNotice(true));
            return false;
          }}
          onError={() => setError(true)}
          onRenderProcessGone={() => setError(true)}
          onContentProcessDidTerminate={() => setError(true)}
        />
      )}
      {notice && (
        <AppDialog
          message={t('common.openLinkFailed')}
          onConfirm={() => setNotice(false)}
          onClose={() => setNotice(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#FFFFFF' },
  failure: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 20 },
  text: { fontFamily: RollpeFonts.display, fontSize: 18, color: '#181818' },
});
