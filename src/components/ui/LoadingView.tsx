import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { OVERLAY_COLOR } from '@/constants/theme';

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
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: { width: '15%', aspectRatio: 2 },
});
