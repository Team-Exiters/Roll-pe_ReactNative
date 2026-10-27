import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { useTranslation } from '@/i18n';

export function RollpeListItem({ title, theme, description, deadline, isPublic, onPress }: {
  title: string; theme: string; description: string; deadline: string; isPublic?: boolean; onPress?: () => void;
}) {
  const colors = useRollpeColors();
  const { t } = useTranslation();
  const hasVisibility = typeof isPublic === 'boolean';
  const badge = <Text style={[styles.badge, { backgroundColor: colors.rollpe_main, color: colors.rollpe_primary }]}>{deadline}</Text>;
  const contents = <>
    {hasVisibility && <View style={styles.statuses}>
      <Text style={[styles.badge, styles.visibility, { borderColor: isPublic ? colors.rollpe_main : colors.rollpe_gray,
        color: isPublic ? colors.rollpe_main : colors.rollpe_gray }]}>{t(isPublic ? 'myPage.public' : 'myPage.private')}</Text>
      {badge}
    </View>}
    <View style={styles.row}>
      <View style={[styles.theme, { backgroundColor: theme === '추모' ? '#393939' : theme === '축하' ? '#FFC0F4' : colors.rollpe_white },
        theme === '화이트' && { borderWidth: 1, borderColor: colors.rollpe_secondary }]}>
        {theme === '축하' && <Image source={require('@/assets/images/home/birthday-cake.svg')} contentFit="contain" accessible={false} style={styles.cake} />}
      </View>
      <View style={styles.info}>
        <View style={styles.heading}>
          {!hasVisibility && badge}
          <Text numberOfLines={1} style={[styles.title, { color: colors.rollpe_secondary }]}>{title}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.description, { color: colors.rollpe_gray }]}>{description}</Text>
      </View>
    </View>
  </>;
  const label = `${title}, ${hasVisibility ? `${t(isPublic ? 'myPage.public' : 'myPage.private')}, ` : ''}${deadline}, ${description}`;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.item}>
    {contents}</Pressable> : <View style={styles.item}>{contents}</View>;
}
const styles = StyleSheet.create({
  item: { paddingVertical: 20 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statuses: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }, visibility: { borderWidth: 1 },
  theme: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cake: { width: 27.6, aspectRatio: 28 / 26 }, info: { flex: 1, gap: 8 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { fontFamily: RollpeFonts.display, fontSize: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' },
  title: { flex: 1, fontFamily: RollpeFonts.display, fontSize: 20 }, description: { fontFamily: RollpeFonts.display, fontSize: 16 },
});
