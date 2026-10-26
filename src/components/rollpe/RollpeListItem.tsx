import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export function RollpeListItem({ title, theme, description, deadline, onPress }: {
  title: string; theme: string; description: string; deadline: string; onPress?: () => void;
}) {
  const colors = useRollpeColors();
  const contents = <>
    <View style={[styles.theme, { backgroundColor: theme === '추모' ? '#393939' : theme === '축하' ? '#FFC0F4' : colors.rollpe_white },
      theme === '화이트' && { borderWidth: 1, borderColor: colors.rollpe_secondary }]}>
      {theme === '축하' && <Image source={require('@/assets/images/home/birthday-cake.svg')} contentFit="contain" accessible={false} style={styles.cake} />}
    </View>
    <View style={styles.info}>
      <View style={styles.heading}>
        <Text style={[styles.badge, { backgroundColor: colors.rollpe_main, color: colors.rollpe_primary }]}>{deadline}</Text>
        <Text numberOfLines={1} style={[styles.title, { color: colors.rollpe_secondary }]}>{title}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.description, { color: colors.rollpe_gray }]}>{description}</Text>
    </View>
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${deadline}, ${description}`} onPress={onPress} style={styles.row}>
    {contents}</Pressable> : <View style={styles.row}>{contents}</View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
  theme: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cake: { width: 27.6, aspectRatio: 28 / 26 }, info: { flex: 1, gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { fontFamily: RollpeFonts.display, fontSize: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' },
  title: { flex: 1, fontFamily: RollpeFonts.display, fontSize: 20 }, description: { fontFamily: RollpeFonts.display, fontSize: 16 },
});
