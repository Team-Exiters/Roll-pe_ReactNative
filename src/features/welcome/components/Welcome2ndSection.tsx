import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export function Welcome2ndSection() {
  const { t } = useTranslation();
  const colors = useRollpeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.rollpe_primary }]}>
      <View style={styles.content}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[styles.title, { color: colors.rollpe_secondary }]}
        >
          {t('welcome.create')}
        </Text>
        <Image
          accessible
          accessibilityLabel={t('welcome.themesImage')}
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
