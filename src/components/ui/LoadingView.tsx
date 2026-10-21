import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export function LoadingView({ accessibilityLabel = '로그인 중' }: { accessibilityLabel?: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
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
