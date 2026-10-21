import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

type RoundedBorderTextFieldProps = Omit<TextInputProps, 'defaultValue'> & {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  value: string;
};

export function RoundedBorderTextField({
  ref,
  value,
  maxLength = 50,
  onFocus,
  onBlur,
  style,
  ...props
}: RoundedBorderTextFieldProps) {
  const colors = useRollpeColors();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      clearButtonMode="never"
      placeholderTextColor={colors.rollpe_gray}
      underlineColorAndroid="transparent"
      {...props}
      ref={ref}
      value={value}
      maxLength={maxLength}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        {
          backgroundColor: colors.rollpe_primary,
          color: colors.rollpe_secondary,
          borderColor: isFocused || value.length > 0 ? colors.rollpe_secondary : colors.rollpe_gray,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    fontFamily: RollpeFonts.display,
    fontSize: 20,
    includeFontPadding: false,
  },
});
