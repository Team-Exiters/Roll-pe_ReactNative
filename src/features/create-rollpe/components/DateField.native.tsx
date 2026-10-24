import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/i18n';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import type { DateFieldProps } from '@/features/create-rollpe/components/DateField';
import { dateLabel, PickerField } from '@/features/create-rollpe/components/PickerField';
import { dateString } from '@/features/create-rollpe/validation';

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function DateField({ value, minimum, maximum, disabled, onChange }: DateFieldProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const colors = useRollpeColors();
  const insets = useSafeAreaInsets();
  const picker = open && <DateTimePicker value={localDate(value)} mode="date"
    minimumDate={localDate(minimum)} maximumDate={localDate(maximum)}
    display={Platform.OS === 'ios' ? 'spinner' : 'default'} locale={i18n.resolvedLanguage} themeVariant="light"
    onValueChange={(_, date) => {
      if (Platform.OS === 'android') setOpen(false);
      onChange(dateString(date));
    }} onDismiss={() => setOpen(false)} />;
  return <>
    <PickerField label={t('create.selectDate')} value={dateLabel(value)} disabled={disabled} onPress={() => setOpen(true)} />
    {Platform.OS === 'android' ? picker : <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('create.closeDate')} style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={{ backgroundColor: colors.rollpe_primary, paddingBottom: insets.bottom }}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.done}>
            <Text style={[styles.doneText, { color: colors.rollpe_main }]}>{t('common.done')}</Text>
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
