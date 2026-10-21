import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/BackButton';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { fetchPolicy, policySpacing, policyType, type PolicyBlock, type PolicyType } from '@/features/policy/content';

function PolicyContent({ type }: { type: PolicyType }) {
  const colors = useRollpeColors();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ blocks?: PolicyBlock[]; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchPolicy(type, controller.signal).then(blocks => {
      if (active) setResult({ blocks });
    }).catch(() => {
      if (active) setResult({ error: '오류가 발생하였습니다.' });
    });
    return () => { active = false; controller.abort(); };
  }, [type, attempt]);
  if (result.error) return <View style={styles.error}>
    <Text style={[styles.text, { color: colors.rollpe_secondary }]} accessibilityRole="alert">{result.error}</Text>
    <Pressable accessibilityRole="button" onPress={() => { setResult({}); setAttempt(value => value + 1); }}>
      <Text style={[styles.text, styles.retry, { color: colors.rollpe_main }]}>다시 시도</Text>
    </Pressable>
  </View>;
  if (!result.blocks) return <ActivityIndicator accessibilityLabel="약관 불러오는 중" color={colors.rollpe_main} />;
  return result.blocks.map((block, index) => <Text key={index} selectable
    accessibilityRole={block.kind === 'h2' || block.kind === 'h3' ? 'header' : undefined}
    style={[styles.text, styles[block.kind], policySpacing(result.blocks!, index), { color: colors.rollpe_secondary }]}>
    {block.kind === 'li' ? '• ' : ''}{block.text}
  </Text>);
}

export default function PolicyScreen() {
  const { type: parameter } = useLocalSearchParams<{ type?: string | string[] }>();
  const type = policyType(parameter);
  const colors = useRollpeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return <View style={[styles.screen, { backgroundColor: colors.rollpe_primary }]}>
    <ScrollView bounces={false} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 20 }]}>
      <Image source={require('@/assets/images/welcome/logo.png')} contentFit="contain"
        accessible accessibilityLabel="롤페" style={styles.logo} />
      <Text style={[styles.title, { color: colors.rollpe_secondary }]} accessibilityRole="header">
        {type === 'terms' ? '서비스 이용약관' : type === 'privacy' ? '개인정보처리방침' : ''}
      </Text>
      <View style={styles.body}>{type ? <PolicyContent key={type} type={type} />
        : <Text style={[styles.text, { color: colors.rollpe_secondary }]}>잘못된 입력값입니다.</Text>}</View>
    </ScrollView>
    <BackButton style={[styles.back, { top: insets.top + 20 }]}
      onPress={() => router.canGoBack() ? router.back() : router.replace('/sign-in')} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  back: { position: 'absolute', left: 20 },
  logo: { width: 104, aspectRatio: 2 },
  title: { fontFamily: RollpeFonts.regular, fontSize: 20, marginTop: 20 },
  body: { width: '100%', marginTop: 40, padding: 8 },
  text: { fontFamily: RollpeFonts.regular, fontSize: 20 },
  p: {},
  h2: { fontFamily: RollpeFonts.semibold, fontSize: 30 },
  h3: { fontFamily: RollpeFonts.semibold, fontSize: 23.4 },
  li: { marginLeft: 40 },
  error: { alignItems: 'center' },
  retry: { padding: 20 },
});
