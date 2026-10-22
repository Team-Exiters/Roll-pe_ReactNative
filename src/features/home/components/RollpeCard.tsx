import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';
import { dDay, type HotRollpe } from '@/features/home/api';

function MarqueeText({ text, size, color }: { text: string; size: number; color: string }) {
  const [width, setWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [offset] = useState(() => new Animated.Value(0));
  useEffect(() => {
    offset.setValue(0);
    if (textWidth <= width || !width) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(1000),
      Animated.timing(offset, {
        toValue: width - textWidth, duration: 8000, easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(1000),
      Animated.timing(offset, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [offset, width, textWidth, text]);
  return <View style={styles.marquee} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Animated.View style={{ flexDirection: 'row', width: 10000, transform: [{ translateX: offset }] }}>
      <Text numberOfLines={1} onLayout={event => setTextWidth(event.nativeEvent.layout.width)}
        style={{ fontFamily: RollpeFonts.display, fontSize: size, color }}>{text}</Text>
    </Animated.View>
    {textWidth > width && <Image source={require('@/assets/images/home/text-fade.svg')}
      accessible={false} pointerEvents="none" contentFit="fill" style={styles.fade} />}
  </View>;
}

export function RollpeCard({ rollpe, onPress }: { rollpe: HotRollpe; onPress: () => void }) {
  const colors = useRollpeColors();
  const deadline = dDay(rollpe.receive.receivingDate);
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
  marquee: { overflow: 'hidden' },
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 10 },
  name: { marginTop: 2 },
});
