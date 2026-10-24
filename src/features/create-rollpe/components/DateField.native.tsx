import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import type { DateFieldProps } from '@/features/create-rollpe/components/DateField';
import { dateLabel, PickerField } from '@/features/create-rollpe/components/PickerField';
import { dateString } from '@/features/create-rollpe/validation';

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function DateField({ value, minimum, maximum, disabled, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const colors = useRollpeColors();
  const insets = useSafeAreaInsets();
  const picker = open && <DateTimePicker value={localDate(value)} mode="date"
    minimumDate={localDate(minimum)} maximumDate={localDate(maximum)}
    display={Platform.OS === 'ios' ? 'spinner' : 'default'} locale="ko-KR" themeVariant="light"
    onValueChange={(_, date) => {
      if (Platform.OS === 'android') setOpen(false);
      onChange(dateString(date));
    }} onDismiss={() => setOpen(false)} />;
  return <>
    <PickerField label="전달일 선택" value={dateLabel(value)} disabled={disabled} onPress={() => setOpen(true)} />
    {Platform.OS === 'android' ? picker : <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="날짜 선택 닫기" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={{ backgroundColor: colors.rollpe_primary, paddingBottom: insets.bottom }}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.done}>
            <Text style={[styles.doneText, { color: colors.rollpe_main }]}>완료</Text>
          </Pressable>
          {picker}
        </View>
      </View>
    </Modal>}
  </>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  done: { alignSelf: 'flex-end', padding: 16 },
  doneText: { fontFamily: RollpeFonts.semibold, fontSize: 16 },
});
