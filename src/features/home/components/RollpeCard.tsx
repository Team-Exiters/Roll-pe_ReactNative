import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useRollpeColors } from '@/constants/theme';
import { MarqueeText } from '@/components/ui/MarqueeText';
import { useTranslation } from '@/i18n';
import { dDay, type HotRollpe } from '@/features/home/api';


export function RollpeCard({ rollpe, onPress }: { rollpe: HotRollpe; onPress: () => void }) {
  const colors = useRollpeColors();
  const { t } = useTranslation();
  const deadline = rollpe.receive.receivingStat === 1 ? t('home.closed') : dDay(rollpe.receive.receivingDate);
  const backgroundColor = rollpe.theme === '추모' ? '#393939' : rollpe.theme === '축하' ? '#FFC0F4' : colors.rollpe_white;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${rollpe.title}, ${rollpe.host.name}, ${deadline}`}
    onPress={onPress} style={styles.card}>
    <View style={[styles.top, { backgroundColor }]}>
      {rollpe.theme === '축하' && <Image source={require('@/assets/images/home/birthday-cake.svg')}
        contentFit="contain" accessible={false} style={styles.cake} />}
      <View style={[styles.badge, { backgroundColor: colors.rollpe_main }]}>
        <Text style={[styles.badgeText, { color: colors.rollpe_primary }]}>{deadline}</Text>
      </View>
    </View>
    <View style={[styles.bottom, { backgroundColor: colors.rollpe_primary }]}>
      <MarqueeText text={rollpe.title} size={16} color={colors.rollpe_secondary} />
      <View style={styles.name}><MarqueeText text={rollpe.host.name} size={12} color={colors.rollpe_gray} /></View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { width: '100%', height: 148, borderRadius: 16, overflow: 'hidden' },
  top: { height: 94 },
  cake: { position: 'absolute', width: '100%', height: '48%', top: '26%' },
  badge: { position: 'absolute', top: 12, left: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10 },
  badgeText: { fontSize: 12 },
  bottom: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  name: { marginTop: 2 },
});
