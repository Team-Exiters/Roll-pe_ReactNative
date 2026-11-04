import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export function Welcome3rdSection() {
  const { t } = useTranslation();
  const colors = useRollpeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.rollpe_section_background }]}>
      <View style={styles.content}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[styles.title, { color: colors.rollpe_secondary }]}
        >
          {t('welcome.memories')}
        </Text>
        <Image
          accessible
          accessibilityLabel={t('welcome.memoriesImage')}
          source={require('@/assets/images/welcome/memory-preview.png')}
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
    paddingTop: 76,
    paddingBottom: 56,
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
    aspectRatio: 630 / 896,
  },
});
