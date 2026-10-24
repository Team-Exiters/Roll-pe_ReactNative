import { Platform, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useSafeAreaSpacing() {
  const insets = useSafeAreaInsets();

  return (edge: 'top' | 'bottom', extra = 0, minimum = 0): DimensionValue => {
    if (Platform.OS !== 'web') return Math.max(minimum, insets[edge] + extra);

    // Expo Router returns zero insets on web; CSS also works during server rendering.
    const inset = `env(safe-area-inset-${edge}, 0px)`;
    const spacing = extra ? `calc(${inset} + ${extra}px)` : inset;
    return (minimum ? `max(${minimum}px, ${spacing})` : spacing) as DimensionValue;
  };
}
