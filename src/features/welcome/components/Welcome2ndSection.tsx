import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export function Welcome2ndSection() {
  const colors = useRollpeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.rollpe_primary }]}>
      <View style={styles.content}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[styles.title, { color: colors.rollpe_secondary }]}>
          {'쉽게 만드는\n우리만의 롤페'}
        </Text>
        <Image
          accessible
          accessibilityLabel="다양한 테마와 메모지로 구성된 롤링페이퍼 예시"
          source={require('@/assets/images/welcome/create-preview.png')}
          contentFit="contain"
          style={styles.preview}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 40,
  },
  content: {
    width: '100%',
    gap: 44,
  },
  title: {
    fontFamily: RollpeFonts.display,
    fontSize: 28,
  },
  preview: {
    width: '100%',
    aspectRatio: 642 / 844,
  },
});
