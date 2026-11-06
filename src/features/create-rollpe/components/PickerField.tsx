import { Pressable, StyleSheet, Text } from 'react-native';

import { t } from '@/i18n';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export function PickerField({
  value,
  label,
  disabled,
  onPress,
}: {
  value: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useRollpeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.field,
        {
          borderColor: value ? colors.rollpe_secondary : colors.rollpe_gray,
          backgroundColor: colors.rollpe_primary,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.rollpe_secondary }]}>{value || ' '}</Text>
    </Pressable>
  );
}

export function dateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return t('create.dateLabel', { year, month, day });
}

const styles = StyleSheet.create({
  field: { borderWidth: 2, borderRadius: 16, padding: 16 },
  text: {
    fontFamily: RollpeFonts.display,
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
});
