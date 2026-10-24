import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Checkbox } from '@/components/ui/Checkbox';
import { RollpeFonts, useRollpeColors } from '@/constants/theme';

type AgreementRowProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  policy?: 'terms' | 'privacy';
};

export function AgreementRow({ label, checked, onCheckedChange, disabled, policy }: AgreementRowProps) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Checkbox accessibilityLabel={label} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      <Text style={[styles.label, { color: colors.rollpe_secondary }]}>{label}</Text>
      {policy && <Pressable accessibilityRole="link" accessibilityLabel={t('common.viewPolicy', { policy: t(policy === 'terms' ? 'common.terms' : 'common.privacy') })}
        disabled={disabled} hitSlop={12} style={styles.link}
        onPress={() => router.push({ pathname: '/policy', params: { type: policy } })}>
        <Text style={[styles.text, { color: colors.rollpe_gray }]}>{t('common.view')}</Text>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: RollpeFonts.display, fontSize: 14, flexShrink: 1 },
  text: { fontFamily: RollpeFonts.display, fontSize: 14 },
  link: { marginLeft: 'auto' },
});
