import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

export const WEB_MAX_WIDTH = 600;

export function WebViewport({ children, style, ...props }: ViewProps) {
  if (Platform.OS !== 'web') return <>{children}</>;

  return <View {...props} style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: WEB_MAX_WIDTH, alignSelf: 'center' },
});
