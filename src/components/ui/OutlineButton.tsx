import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

type OutlineButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  textStyle?: StyleProp<TextStyle>;
};

export function OutlineButton({ title, textStyle, disabled, style, ...props }: OutlineButtonProps) {
  const colors = useRollpeColors();

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={(state) => [
        styles.button,
        { borderColor: colors.rollpe_main, opacity: disabled ? 0.5 : state.pressed ? 0.7 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Text style={[styles.label, { color: colors.rollpe_main }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: RollpeFonts.semibold, fontSize: 16, textAlign: 'center' },
});
