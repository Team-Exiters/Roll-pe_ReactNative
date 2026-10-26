import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { dDay } from '@/features/home/api';
import type { SearchRollpe } from '@/features/search/api';
import { useTranslation } from '@/i18n';

export function SearchRollpeItem({ rollpe, onPress }: { rollpe: SearchRollpe; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useRollpeColors();
  const date = new Date(rollpe.createdAt);
  const createdAt = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  const description = t('search.hostAndDate', { name: rollpe.host.name, date: createdAt });
  const deadline = dDay(rollpe.receivingDate);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${rollpe.title}, ${deadline}, ${description}`}
    onPress={onPress} style={styles.row}>
    <View style={[styles.theme, { backgroundColor: rollpe.theme === '추모' ? '#393939' : rollpe.theme === '축하' ? '#FFC0F4' : colors.rollpe_white },
      rollpe.theme === '화이트' && { borderWidth: 1, borderColor: colors.rollpe_secondary }]}>
      {rollpe.theme === '축하' && <Image source={require('@/assets/images/home/birthday-cake.svg')} contentFit="contain" accessible={false} style={styles.cake} />}
    </View>
    <View style={styles.info}>
      <View style={styles.heading}>
        <Text style={[styles.badge, { backgroundColor: colors.rollpe_main, color: colors.rollpe_primary }]}>{deadline}</Text>
        <Text numberOfLines={1} style={[styles.title, { color: colors.rollpe_secondary }]}>{rollpe.title}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.description, { color: colors.rollpe_gray }]}>{description}</Text>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
  theme: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cake: { width: 27.6, aspectRatio: 28 / 26 }, info: { flex: 1, gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { fontFamily: RollpeFonts.display, fontSize: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' },
  title: { flex: 1, fontFamily: RollpeFonts.display, fontSize: 20 }, description: { fontFamily: RollpeFonts.display, fontSize: 16 },
});
