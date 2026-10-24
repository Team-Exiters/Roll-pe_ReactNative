import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/i18n';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import type { DateFieldProps } from '@/features/create-rollpe/components/DateField';
import { dateLabel, PickerField } from '@/features/create-rollpe/components/PickerField';
import { dateString } from '@/features/create-rollpe/validation';
import { AppModal } from '@/components/ui/AppModal';

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
    {Platform.OS === 'android' ? picker : <AppModal visible={open} animationType="slide" onClose={() => setOpen(false)}
      contentStyle={styles.sheet} backdrop={<Pressable accessibilityRole="button" accessibilityLabel={t('create.closeDate')}
        style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={() => setOpen(false)} />}>
      <View accessibilityViewIsModal style={{ backgroundColor: colors.rollpe_primary, paddingBottom: insets.bottom }}>
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.done}>
          <Text style={[styles.doneText, { color: colors.rollpe_main }]}>{t('common.done')}</Text>
        </Pressable>
        {picker}
      </View>
    </AppModal>}
  </>;
}

const styles = StyleSheet.create({
  sheet: { justifyContent: 'flex-end', padding: 0 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  done: { alignSelf: 'flex-end', padding: 16 },
  doneText: { fontFamily: RollpeFonts.semibold, fontSize: 16 },
});
