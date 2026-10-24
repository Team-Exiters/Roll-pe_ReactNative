import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';

export function LoadingView({ accessibilityLabel }: { accessibilityLabel?: string }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('auth.signingIn')}
      style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Image
        source={require('@/assets/images/loading.gif')}
        contentFit="contain"
        accessible={false}
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: { width: '15%', aspectRatio: 2 },
});
