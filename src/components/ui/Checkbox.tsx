import { Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useRollpeColors } from '@/constants/theme';

type CheckboxProps = Omit<PressableProps, 'children' | 'onPress'> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function Checkbox({ checked, onCheckedChange, style, ...props }: CheckboxProps) {
  const colors = useRollpeColors();

  return (
    <Pressable
      hitSlop={12}
      {...props}
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityState={{
        ...props.accessibilityState,
        checked,
        disabled: Boolean(props.disabled),
      }}
      onPress={() => onCheckedChange(!checked)}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        // React Native Web의 checkbox 역할에는 Space 키 처리가 제공되지 않습니다.
        if (Platform.OS === 'web' && event.nativeEvent.key === ' ' && !event.isDefaultPrevented()) {
          event.preventDefault();
          if (!props.disabled && !event.nativeEvent.repeat) {
            onCheckedChange(!checked);
          }
        }
      }}
      style={(state) => [
        styles.checkbox,
        { backgroundColor: colors.rollpe_primary, borderColor: colors.rollpe_gray },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {checked && <View style={[styles.checkmark, { backgroundColor: colors.rollpe_main }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 10,
    height: 10,
    borderRadius: 1,
  },
});
