import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { RollpeFonts } from '@/constants/theme';

export function MarqueeText({ text, size, color, centered = false }: { text: string; size: number; color: string; centered?: boolean }) {
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
    <Animated.View style={{ flexDirection: 'row', width: 10000, marginLeft: centered && textWidth < width ? (width - textWidth) / 2 : 0, transform: [{ translateX: offset }] }}>
      <Text numberOfLines={1} onLayout={event => setTextWidth(event.nativeEvent.layout.width)}
        style={{ fontFamily: RollpeFonts.display, fontSize: size, color }}>{text}</Text>
    </Animated.View>
    {textWidth > width && <Image source={require('@/assets/images/home/text-fade.svg')}
      accessible={false} pointerEvents="none" contentFit="fill" style={styles.fade} />}
  </View>;
}


const styles = StyleSheet.create({
  marquee: { overflow: 'hidden' },
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 10 },
});
