import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, Linking, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { RollpeFonts, useRollpeColors } from '@/constants/theme';

export function HomeSideMenu({ onClose, onUnavailable }: { onClose: () => void; onUnavailable: () => void }) {
  const colors = useRollpeColors();
  const { width } = useWindowDimensions();
  const menuWidth = width * 0.8;
  const [offset] = useState(() => new Animated.Value(menuWidth));
  const [opacity] = useState(() => new Animated.Value(0));
  const driver = Platform.OS !== 'web';
  function close() {
    Animated.parallel([
      Animated.timing(offset, { toValue: menuWidth, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: driver }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: driver }),
    ]).start(({ finished }) => { if (finished) onClose(); });
  }
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => offset.setValue(Math.max(0, gesture.dx)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > width * 0.4 || gesture.vx * 1000 > width * 0.4) close();
      else Animated.timing(offset, { toValue: 0, duration: 250, useNativeDriver: driver }).start();
    },
    onPanResponderTerminate: () => Animated.timing(offset, { toValue: 0, duration: 250, useNativeDriver: driver }).start(),
  });
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(offset, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: driver }),
      Animated.timing(opacity, { toValue: 0.25, duration: 250, useNativeDriver: driver }),
    ]);
    animation.start();
    return () => { animation.stop(); offset.stopAnimation(); opacity.stopAnimation(); };
  }, [offset, opacity, driver]);
  return <Modal transparent visible animationType="none" onRequestClose={close}>
    <View style={styles.screen} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" style={StyleSheet.absoluteFill} onPress={close} />
      <Animated.View {...pan.panHandlers} style={[styles.menu, { width: menuWidth, backgroundColor: colors.rollpe_primary,
        transform: [{ translateX: offset }] }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" hitSlop={16} style={styles.close} onPress={close}>
          <Image source={require('@/assets/images/home/close.svg')} contentFit="contain" accessible={false} style={styles.closeIcon} />
        </Pressable>
        <View style={styles.contents}>
          {['홈', '검색', '1:1 문의', '마이페이지'].map(label => <Pressable key={label} accessibilityRole="button"
            onPress={() => {
              if (label === '홈') return;
              if (label === '1:1 문의') void Linking.openURL('https://forms.gle/WGC7ibNBgTnomRgZ7').catch(onUnavailable);
              else onUnavailable();
            }}>
            <Text style={[styles.label, { color: label === '홈' ? colors.rollpe_main : colors.rollpe_secondary }]}>{label}</Text>
          </Pressable>)}
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  menu: { position: 'absolute', right: 0, top: 0, bottom: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  close: { position: 'absolute', top: 80, right: 28 },
  closeIcon: { width: 12, height: 12 },
  contents: { marginTop: 120, marginHorizontal: 40, gap: 40 },
  label: { fontFamily: RollpeFonts.display, fontSize: 40 },
});
