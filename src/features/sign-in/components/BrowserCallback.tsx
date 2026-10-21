import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export default function BrowserCallback() {
  const colors = useRollpeColors();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      Promise.resolve()
        .then(() => WebBrowser.maybeCompleteAuthSession())
        .then((result) => {
          if (active) setFailed(result.type === 'failed');
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }
    return () => { active = false; };
  }, []);

  if (Platform.OS !== 'web') return <Redirect href="/sign-in" />;

  return (
    <View style={[styles.container, { backgroundColor: colors.rollpe_primary }]}>
      {!failed && <ActivityIndicator color={colors.rollpe_main} />}
      <Text style={[styles.message, { color: colors.rollpe_secondary }]}>
        {failed ? '로그인 화면에서 다시 시도해주세요.' : '로그인 결과를 확인하고 있습니다.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 },
  message: { fontFamily: RollpeFonts.regular, fontSize: 16, textAlign: 'center' },
});
