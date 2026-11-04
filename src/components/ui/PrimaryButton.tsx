import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

type PrimaryButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  textStyle?: StyleProp<TextStyle>;
};

export function PrimaryButton({ title, textStyle, disabled, style, ...props }: PrimaryButtonProps) {
  const colors = useRollpeColors();
  const [backgroundOpacity] = useState(() => new Animated.Value(disabled ? 0.5 : 1));

  useEffect(() => {
    const animation = Animated.timing(backgroundOpacity, {
      toValue: disabled ? 0.5 : 1,
      duration: 250,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
      useNativeDriver: Platform.OS !== 'web',
    });

    animation.start();
    return () => animation.stop();
  }, [backgroundOpacity, disabled]);

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={(state) => [styles.button, typeof style === 'function' ? style(state) : style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.background,
          { backgroundColor: colors.rollpe_main, opacity: backgroundOpacity },
        ]}
      />
      <Text style={[styles.title, { color: colors.rollpe_primary }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    padding: 16,
  },
  background: {
    borderRadius: 8,
  },
  title: {
    fontFamily: RollpeFonts.semibold,
    fontSize: 16,
    textAlign: 'center',
  },
});
