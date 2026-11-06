import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { dateLabel, PickerField } from '@/features/create-rollpe/components/PickerField';

export type DateFieldProps = {
  value: string;
  minimum: string;
  maximum: string;
  disabled: boolean;
  onChange: (date: string) => void;
};

// Web uses the browser's date picker; the native file uses UIDatePicker/Android's dialog.
export function DateField({ value, minimum, maximum, disabled, onChange }: DateFieldProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <View style={styles.field}>
      <PickerField
        label={t('create.selectDate')}
        value={dateLabel(value)}
        disabled={disabled}
        onPress={() => input.current?.showPicker?.()}
      />
      <input
        ref={input}
        type="date"
        aria-label={t('create.selectDate')}
        value={value}
        min={minimum}
        max={maximum}
        disabled={disabled}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onChange={(event) => {
          if (event.currentTarget.value) onChange(event.currentTarget.value);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ field: { position: 'relative' } });
